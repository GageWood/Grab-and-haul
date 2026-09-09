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
        text: `You are the estimating assistant for Grab & Haul Removal Services. Analyze ALL customer photos together as ONE junk-removal job.

IMPORTANT: Estimate the amount of material that will occupy the trailer AFTER reasonable loading, stacking, nesting, folding, and partial disassembly. Do NOT estimate the apparent floor area of the room, garage, or photo pile. Do NOT treat the visual bounding box of the objects as cubic-yard volume.

TRAILER REFERENCE:
- Interior: 6 ft wide x 12 ft long x 3 ft high.
- Maximum physical capacity: 8 cubic yards (216 cubic feet).
- 1 yard = 27 cubic feet.
- 1 yard is roughly 1/8 of this trailer.
- 2 yards = 1/4 trailer.
- 3 yards = 3/8 trailer.
- 4 yards = 1/2 trailer.
- 5 yards = 5/8 trailer.
- 6 yards = 3/4 trailer.
- 7 yards = 7/8 trailer.
- 8 yards = full trailer.

CURRENT CUSTOMER VOLUME PRICING: ${priceText}

ESTIMATING METHOD:
1. Identify the actual objects visible across all photos and avoid double-counting objects shown from multiple angles.
2. Estimate each meaningful item or group by its realistic LOADED junk-removal space.
3. Give strong credit for nesting, folding, stacking, empty space inside frames, and partial disassembly when those are practical.
4. Sum the loaded-space estimates and sanity-check the result against the 6x12x3 trailer reference above.
5. Separate bulky-looking but highly collapsible items from dense solid material. Bicycles, folding chairs/cots, shelving, exercise equipment frames, empty bins, cardboard, bags, and similar items can occupy much less trailer volume when loaded efficiently than their loose visual footprint suggests.
6. Do not automatically add large amounts of volume just because a photo looks densely packed. Ask: could a normal two-person junk-removal crew load this more tightly into the trailer?
7. Use the lower end of a reasonable range when the photos show mostly collapsible, stackable, nestable, or loosely packed household goods. Use the higher end when there are genuinely bulky solid items, dense loose debris, or substantial hidden material.
8. Do not assume unseen rooms, closets, piles, or objects. Only estimate what is visible.
9. The minimum customer charge is $150, but do not force every job to 2+ yards if the visible material is genuinely closer to 1 yard.
10. The recommended volume must be a whole number from 1 through 8 and should reflect the most likely loaded trailer space, not an intentionally padded quote. The owner will review it before quoting.

CALIBRATION EXAMPLES FOR VISUAL REASONING (use as rough anchors, not rigid rules):
- A standard moving box is usually around 0.1 cubic yard of loaded space; a large tote/bin is often around 0.15–0.25 yard depending on size and nesting.
- A contractor bag or similar loose household bag is often around 0.15–0.2 yard when loaded.
- A typical bicycle may only contribute roughly 0.25–0.4 yard of loaded space when multiple bikes can be nested together.
- A folding chair/cot can contribute roughly 0.1–0.25 yard depending on size and quantity; several should be stacked together rather than treated as separate full boxes.
- A typical 3-seat sofa is often around 1.5–2.5 yards; a loveseat around 1–1.5 yards; a recliner around 0.75–1 yard. Use these only as sanity checks.
- Large open-frame exercise equipment can be deceptive: estimate its actual loaded footprint after folding/positioning, not the entire empty rectangular space around it.
- TVs and flat electronics are relatively thin and should not be assigned furniture-sized volume merely because the screen is large.

A key calibration principle: if a set of photos contains several bicycles, folding/collapsible equipment, boxes, bags, bins, shelving, and one or two bulky frames, it can still be only a few cubic yards after efficient loading. Do not jump to 6–8 yards unless the visible material truly represents at least roughly three-quarters of this 8-yard trailer.

UNCERTAINTY:
Return a realistic range, but do not make the range unnecessarily wide. If the most likely loaded volume is around 2–3 yards, the result should be something like 2–3, not 5–7. If photos are insufficient to judge volume, lower confidence rather than inflating the estimate.

HEAVY MATERIAL:
If the job appears unusually dense/heavy (concrete, dirt, brick, roofing, tile, soil, etc.), set heavy_material_warning to true and flag it for a separate heavy-material quote rather than assuming normal junk pricing.

SPECIAL ITEMS:
Identify only obvious special-charge items that are actually visible, including mattresses, box springs, refrigerators/freezers, window A/C units, large A/C units, TVs/electronics, tires, and tires with rims. Do not invent items. A visible TV/electronic should be listed as a potential special item, but do not inflate cubic-yard volume because of it.

Choose the recommended whole-yard volume from 1 through 8 and the corresponding current price from the pricing table. The server will enforce the price from the table. Return ONLY the requested JSON.`
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
