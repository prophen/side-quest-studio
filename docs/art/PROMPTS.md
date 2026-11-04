# Asset generation

Generated using the built-in image_gen tool. Reference photo is intentionally excluded from this public repository.

## studio-room.png

Reference: studio-concept.png.

Edit this pixel-art studio room background for use as a game asset. Preserve exact composition, perspective, palette, furniture placement, cat, room geometry, image dimensions and all other details. Remove only the open notebook from the writing desk and the desk chair directly in front of that desk. Fill the notebook area with matching clean wooden desktop; fill the chair area with the matching floor. This allows a separate moving player sprite to stand at the desk. Keep all remaining items and background exactly as is. No new text.

## character-standing.png

Reference: character-concept.png. Transparent background requested.

Create one isolated game sprite based on the woman in this approved character concept sheet. Use only a single full-body standing character, three-quarter view facing left, ready to approach a writing desk. Keep her likeness, brown skin, very short natural hair, adult woman proportions, sage gray T-shirt, blue jeans, cream sneakers. Same crisp cozy retro pixel-art style. Arms naturally by sides, both feet visible, full body centered with modest transparent margin. Transparent background, no floor, no shadow, no furniture, no border, no text, no extra poses. This is one usable game character sprite.

## Walking sprite atlas

`public/art/character-walk.png` was generated with the built-in image-generation tool, using the standing character as reference. Eight complete walking poses replace the CSS limb cutouts. The atlas is 1536×1024, four columns and two rows. The first column needs a 32-pixel horizontal alignment correction relative to the others.

Final cleanup prompt: Background removal ONLY. Preserve these exact eight character sprites, exact pixel positions, exact 1536x1024 canvas, four columns two rows. Remove ALL background including dark brown and blue glow/halo between and around characters. Make every non-character pixel completely transparent alpha 0. Keep opaque character pixels, edges, poses, size, coordinates and colors unchanged. No shadow, no glow, no colored matte. This is a transparent game sprite atlas.
