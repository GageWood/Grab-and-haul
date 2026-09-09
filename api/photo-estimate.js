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

Your job is to estimate the amount of junk that will occupy the trailer AFTER the crew loads it efficiently. The estimate is for loaded trailer space, not the apparent size of the room, garage, floor area, or loose pile shown in a photo.

CRITICAL SCOPE RULE — RED MARKINGS:
- RED MARKINGS DEFINE THE ESTIMATE SCOPE whenever any red marking is present.
- If the user has marked a photo in red, estimate ONLY the item(s) directly indicated by the red marking(s). Ignore unrelated unmarked material.
- A red marking may be a complete circle, partial circle, line, arrow, box, bracket, underline, or another obvious red mark pointing to or surrounding an item or group.
- Do NOT require a closed circle. A partial circle is still a valid scope indicator.
- If a red marking is cut off by the edge of the photo, treat the marking as continuing beyond the visible image only for understanding what it indicates. Estimate ONLY the visible portion of the indicated item or group. Never invent or estimate hidden material beyond the photo edge.
- If the red marking crosses or overlaps several objects, include the objects clearly indicated by the marking. If it merely passes near an object, do not automatically include that object.
- If the marking surrounds a group of loose items, estimate the group as one loadable group and avoid double-counting its individual contents.
- If a red arrow or line points to an item, estimate the item it clearly points to, not everything near the line.
- If a marked item is partially obscured, estimate only what can reasonably be seen and state the uncertainty. Do not invent hidden dimensions or contents.
- Use unmarked portions of the photo ONLY for context, scale, perspective, and understanding the marked item(s). Do not add unmarked material to the volume just because it is visible.
- If multiple photos show the same item or group, count it only once. Use the clearest view to estimate it.
- If different red markings identify different items/groups, estimate all clearly marked items/groups together, while avoiding overlap and double-counting.
- If NO red markings are present in any photo, estimate the visible material normally.

MARKING INTERPRETATION — AVOID HALLUCINATION:
- Do not assume a red mark identifies an item unless the visual relationship is reasonably clear.
- Do not infer that the user wants an entire room, garage, wall, floor, or surrounding pile simply because those areas are visible.
- Do not expand the scope beyond a marked item/group based on what would normally be removed from a job.
- Do not turn ambiguous red scribbles into specific objects that cannot be identified.
- If the marked scope is genuinely unclear, keep the estimate conservative and explain exactly what is uncertain.
- Red markup itself has zero volume and must never affect cubic-yard calculations.

TRAILER:
- Interior: 6 ft wide x 12 ft long x 3 ft high.
- Maximum capacity: 8 cubic yards = 216 cubic feet.
- 1 yard = 1/8 of the trailer.
- 2 yards = 1/4 trailer.
- 3 yards = 3/8 trailer.
- 4 yards = 1/2 trailer.
- 5 yards = 5/8 trailer.
- 6 yards = 3/4 trailer.
- 7 yards = 7/8 trailer.
- 8 yards = full trailer.

CURRENT CUSTOMER VOLUME PRICING: ${priceText}

PRIMARY ESTIMATING METHOD — ITEMIZE FIRST:
1. Review every photo together and identify the actual objects within the defined scope.
2. Do not double-count an object visible in multiple photos.
3. For each meaningful item/group, mentally assign a realistic loaded-space volume based on its physical size, not its visual bounding box.
4. Add those item volumes together to get a RAW LOADED VOLUME.
5. Account for practical loading: nesting bikes together, stacking chairs, folding cots, collapsing equipment when reasonable, flattening cardboard, nesting bins, putting bags/boxes inside available cavities, and placing smaller items inside/around larger objects.
6. Do NOT add a generic safety percentage to the raw total. Uncertainty belongs in the range and confidence, NOT in automatic upward padding.
7. Sanity-check the total against the actual 6x12x3 trailer fractions.
8. Only recommend 5+ yards when the in-scope material would realistically consume more than half the trailer after efficient loading. Only recommend 6–8 yards when the in-scope material visibly approaches roughly 3/4 to full trailer capacity.
9. Do not assume hidden material. Estimate only what is visible and within the defined scope.
10. A busy-looking photo is NOT automatically a large load. Small household goods, boxes, bags, bins, clothing, cardboard, and collapsible equipment can have a surprisingly small loaded volume.
11. If the raw itemized estimate is between two whole-yard price tiers, choose the nearest practical whole yard based on the most likely loaded volume. Do not automatically round up. If it is genuinely close to the boundary and underestimating is a meaningful risk, use the higher tier and explain why.

ROUGH ITEM VOLUME ANCHORS — USE AS SANITY CHECKS:
- Small/standard moving box: about 0.1 CY.
- Large box/tote/bin: about 0.15–0.25 CY, with nesting where possible.
- Contractor/large household bag: about 0.15–0.2 CY when loaded.
- Typical bicycle: about 0.25–0.4 CY when positioned efficiently; multiple bikes can nest together.
- Folding chair: about 0.1–0.15 CY each when stacked.
- Folding cot/lounge chair: about 0.15–0.3 CY when folded.
- Loveseat/two-seat sofa: about 1–1.5 CY depending on size.
- Typical 3-seat sofa: about 1.5–2.5 CY.
- Recliner: about 0.75–1 CY.
- Small cabinet: about 0.4–0.7 CY depending on dimensions.
- Large flat-screen TV: thin; usually only a small fraction of a cubic yard of actual loaded volume. Do not treat it like a sofa or cabinet.
- Open-frame elliptical/stepper/exercise equipment: estimate the actual loaded footprint after positioning/folding; do not count the empty air around the frame.

IMPORTANT CALIBRATION EXAMPLES:
- A loveseat + small cabinet + folding cot + printer/papers/small items is generally around 2–2.5 loaded CY, not 4 CY, unless the photos show substantial additional material within scope.
- Several bicycles + folding equipment + shelving/bins + boxes can be around 3–4 CY when loaded efficiently. Do not automatically call this 5–6 CY.
- A collection of boxes, bags, bins, folded fabric/cushions, and small household goods can easily be around 2–3 CY even when spread across a garage floor.
These are calibration anchors, not fixed answers. Adjust for what is actually visible and within scope.

RANGE AND CONFIDENCE:
- estimated_low and estimated_high should represent a realistic uncertainty range around the itemized loaded estimate.
- Keep the range reasonably tight when the marked scope is clear. A likely 2.2 CY load might be 2–3, not 2–4 or 3–5.
- Lower confidence when photos are incomplete, badly angled, dark, or lack scale; do not compensate for poor visibility by inflating volume.
- The recommended_volume is the most likely whole-yard loaded volume, not the high end of the range.
- When red markings define scope, the range must describe uncertainty in the MARKED MATERIAL ONLY.

HEAVY MATERIAL:
If concrete, dirt, brick, roofing, tile, soil, or other unusually dense/heavy material is visible AND within the marked scope, set heavy_material_warning to true and flag the job for a separate heavy-material quote rather than assuming normal junk pricing. Unmarked heavy material should not trigger the warning unless there are no red markings and the normal full-photo estimate applies.

SPECIAL ITEMS:
Identify only obvious special-charge items actually visible AND within the marked scope, including mattresses, box springs, refrigerators/freezers, window A/C units, large A/C units, TVs/electronics, tires, and tires with rims. Do not invent items. A visible TV/electronic may be a special item but should not inflate its cubic-yard volume.

Return ONLY the requested JSON. The server will enforce the final price from the current pricing table.`
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
