export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Photo estimate service is not configured yet." });
    return;
  }

  try {
    const { images, pricing } = req.body || {};
    if (!Array.isArray(images) || images.length === 0) {
      res.status(400).json({ error: "Upload at least one photo." });
      return;
    }
    if (images.length > 8) {
      res.status(400).json({ error: "Please upload no more than 8 photos." });
      return;
    }

    const prices = pricing || { 1: 150, 2: 225, 3: 300, 4: 375, 5: 450, 6: 525, 7: 600, 8: 650 };
    const priceText = Object.entries(prices).map(([yards, price]) => `${yards} yard${yards === "1" ? "" : "s"}: $${price}`).join(", ");

    const content = [
      {
        type: "input_text",
        text: `You are the estimating assistant for Grab & Haul Removal Services. Analyze ALL customer photos together as one job. Estimate how much trailer space the visible material will occupy after loading, not the loose pile volume in the photos. Use practical junk-removal estimating judgment. The trailer is treated as an 8-cubic-yard maximum load. Current customer volume pricing is: ${priceText}.\n\nReturn a conservative but realistic estimate. Hidden material, stacked material, density, and lack of scale create uncertainty. Do not pretend the photos give exact cubic-yard measurements. If the job appears unusually dense/heavy (concrete, dirt, brick, roofing, etc.), flag it for a separate heavy-material quote rather than assuming normal junk pricing.\n\nIdentify obvious special-charge items when visible, including mattresses, box springs, refrigerators/freezers, window A/C units, large A/C units, TVs/electronics, tires, and tires with rims. Do not invent items that are not visible.\n\nChoose one recommended whole-yard volume from 1 through 8. When uncertain between two volumes, choose the higher volume so the owner can review it. Recommend the corresponding current price from the table. The owner will make the final decision before quoting the customer.`
      },
      ...images.map(image => ({
        type: "input_image",
        image_url: image,
        detail: "high"
      }))
    ];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "junk_quote_estimate",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                recommended_volume: { type: "integer", minimum: 1, maximum: 8 },
                estimated_low: { type: "integer", minimum: 1, maximum: 8 },
                estimated_high: { type: "integer", minimum: 1, maximum: 8 },
                confidence: { type: "string", enum: ["low", "medium", "high"] },
                recommended_price: { type: "number", minimum: 0 },
                observed_items: { type: "array", items: { type: "string" } },
                special_items: { type: "array", items: { type: "string" } },
                heavy_material_warning: { type: "boolean" },
                notes: { type: "string" }
              },
              required: ["recommended_volume", "estimated_low", "estimated_high", "confidence", "recommended_price", "observed_items", "special_items", "heavy_material_warning", "notes"]
            }
          }
        }
      })
    });

    const raw = await response.text();
    if (!response.ok) {
      let message = "AI estimate failed.";
      try { message = JSON.parse(raw)?.error?.message || message; } catch (_) {}
      console.error("OpenAI API error:", response.status, message);
      res.status(response.status).json({ error: message });
      return;
    }

    const data = JSON.parse(raw);

    // The raw REST response does not expose the SDK-only `output_text` helper.
    // Extract the generated text from the response output items instead.
    const outputText = Array.isArray(data.output)
      ? data.output
          .filter(item => item?.type === "message")
          .flatMap(item => Array.isArray(item.content) ? item.content : [])
          .filter(item => item?.type === "output_text" && typeof item.text === "string")
          .map(item => item.text)
          .join("")
      : "";

    if (!outputText) {
      console.error("OpenAI returned no output text:", JSON.stringify({ status: data.status, output: data.output }));
      res.status(502).json({ error: "The AI returned no estimate." });
      return;
    }

    const estimate = JSON.parse(outputText);
    estimate.recommended_volume = Math.max(1, Math.min(8, Math.round(estimate.recommended_volume)));
    estimate.estimated_low = Math.max(1, Math.min(8, Math.round(estimate.estimated_low)));
    estimate.estimated_high = Math.max(estimate.estimated_low, Math.min(8, Math.round(estimate.estimated_high)));
    estimate.recommended_price = Number(prices[estimate.recommended_volume] || 0);

    res.status(200).json(estimate);
  } catch (err) {
    console.error("Photo estimate error:", err);
    res.status(500).json({ error: "Unable to analyze the photos right now." });
  }
}
