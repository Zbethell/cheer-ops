// Finds the face in a submitted photo and works out where to crop it so the
// head sits properly inside the card's photo window.
//
// Everything runs in the browser. The photo is never sent anywhere for
// analysis, which matters here: these are photographs of minors, and the
// submissions are already only reachable behind the admin gate.
//
// The model is BlazeFace, served from public/models/blazeface rather than from
// tfhub.dev. The upstream URL now redirects to a Kaggle signed link that
// expires after three hours, so depending on it would mean card printing breaks
// on somebody else's schedule. Locally hosted it is ~466KB and works offline.
//
// Nothing here is load-bearing for correctness: if detection fails, or the
// model will not load at all, the caller falls back to a centred crop and the
// operator nudges it by hand. Auto-framing is there to save time, not to be
// trusted blindly, which is why the print screen always shows the result before
// anything reaches the printer.

import { HOLE, coverCrop } from "./cardRender.js";

/** Below this, a detection is treated as no detection. */
export const MIN_CONFIDENCE = 0.75;

// How far the eyes may sit out of level, as a fraction of the box height,
// before the detection is worth a second look.
const MAX_EYE_TILT = 0.25;

/**
 * Whether a detection's landmarks are arranged the way a face's actually are.
 *
 * BlazeFace is a fast detector, not a careful one, and it is confidently wrong
 * on graphics: the Ontario Cheer logo scores 89% and a printed test card 99%.
 * The score on its own is therefore not a trust signal, but the landmark
 * geometry does separate them - measured across real portraits and known false
 * positives, the eyes sat within 0.07 of level on every real face and 0.32 out
 * on the logo.
 *
 * These checks read only the geometry of the six landmarks, never colour or
 * texture, so they behave identically for every face.
 *
 * Nothing here rejects a detection. A real photo wrongly rejected costs the
 * operator a manual crop, while a wrong one accepted is caught by the thumbnail
 * review that happens anyway - so an unusual result is flagged, not discarded.
 * A genuinely tilted head gets flagged too, which is the right outcome.
 */
export function faceLooksPlausible(face) {
  const reasons = [];
  const L = face.landmarks;
  const bw = face.x2 - face.x1;
  const bh = face.y2 - face.y1;
  if (!(bw > 0 && bh > 0)) return { plausible: false, reasons: ["the detected box is empty"] };
  // Some detections carry no landmarks; there is then nothing to judge.
  if (!L || L.length < 6) return { plausible: true, reasons };

  const [rightEye, leftEye, nose, , rightEar, leftEar] = L;
  const eyeLo = Math.min(rightEye[0], leftEye[0]);
  const eyeHi = Math.max(rightEye[0], leftEye[0]);
  const earLo = Math.min(rightEar[0], leftEar[0]);
  const earHi = Math.max(rightEar[0], leftEar[0]);

  if (Math.abs(leftEye[1] - rightEye[1]) / bh > MAX_EYE_TILT) reasons.push("the eyes are not level");
  if (nose[0] < eyeLo || nose[0] > eyeHi) reasons.push("the nose is not between the eyes");
  if (earLo > eyeLo || earHi < eyeHi) reasons.push("the ears are not outside the eyes");

  return { plausible: reasons.length === 0, reasons };
}

// BlazeFace's box runs roughly from the eyebrows to the chin: it does not
// include the forehead or hair. Measured against portrait photos, the whole
// head is about 1.45x that box.
const HEAD_TO_BOX = 1.45;

// How much of the window's height the head should fill. Passport rules ask for
// 70-80%, which is unflatteringly tight for a credential card; 62% leaves
// visible shoulders and a little space above the hair.
const HEAD_FRACTION = 0.62;

// Where the eye line sits, measured down from the top of the crop. Putting the
// eyes slightly above centre is what makes a portrait look composed rather than
// like a snapshot.
const EYE_LINE = 0.42;

const WINDOW_ASPECT = HOLE.w / HOLE.h;

let detectorPromise = null;

/**
 * Loads the model once per page. The imports are dynamic so that none of
 * TensorFlow reaches the main bundle — it is fetched only when someone opens
 * the card printing screen.
 */
export function loadDetector() {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    const tf = await import("@tensorflow/tfjs-core");
    await import("@tensorflow/tfjs-converter");
    try {
      await import("@tensorflow/tfjs-backend-webgl");
      await tf.setBackend("webgl");
    } catch {
      // Software rendering, an old driver, or a locked-down machine. Slower by
      // a good margin but it still produces the same answer.
      await import("@tensorflow/tfjs-backend-cpu");
      await tf.setBackend("cpu");
    }
    await tf.ready();
    const blazeface = await import("@tensorflow-models/blazeface");
    return blazeface.load({ modelUrl: "/models/blazeface/model.json" });
  })().catch((e) => {
    // Let the next attempt retry rather than caching the failure forever.
    detectorPromise = null;
    throw e;
  });
  return detectorPromise;
}

/**
 * The largest face in the image, or null.
 *
 * Largest rather than most confident: a group photo of a coach and their team
 * should frame the person nearest the camera, and in a portrait there is only
 * one face anyway.
 */
export async function detectFace(image) {
  const model = await loadDetector();
  const faces = await model.estimateFaces(image, false);
  if (!faces?.length) return null;

  const scored = faces
    .map((f) => {
      const [x1, y1] = f.topLeft;
      const [x2, y2] = f.bottomRight;
      const probability = Array.isArray(f.probability) ? f.probability[0] : f.probability;
      return { ...f, x1, y1, x2, y2, area: (x2 - x1) * (y2 - y1), probability };
    })
    .filter((f) => f.probability >= MIN_CONFIDENCE && f.area > 0);

  if (!scored.length) return null;
  scored.sort((a, b) => b.area - a.area);
  return scored[0];
}

/**
 * Turns a detected face into a crop box in source-image pixels, shaped to the
 * card's photo window.
 */
export function frameFromFace(face, imgW, imgH) {
  const boxH = face.y2 - face.y1;

  // Landmarks are [rightEye, leftEye, nose, mouth, rightEar, leftEar]. The eye
  // midpoint beats the box centre for anyone whose head is turned.
  const eyes = face.landmarks?.slice(0, 2);
  const eyeX = eyes?.length === 2 ? (eyes[0][0] + eyes[1][0]) / 2 : (face.x1 + face.x2) / 2;
  const eyeY = eyes?.length === 2 ? (eyes[0][1] + eyes[1][1]) / 2 : face.y1 + boxH * 0.4;

  let cropH = (boxH * HEAD_TO_BOX) / HEAD_FRACTION;
  let cropW = cropH * WINDOW_ASPECT;

  // A face photographed close up can want a crop larger than the photo itself.
  const shrink = Math.min(1, imgW / cropW, imgH / cropH);
  cropW *= shrink;
  cropH *= shrink;

  // Position, then slide back inside the image. Sliding is deliberate: losing
  // the intended composition is better than padding the card with blank space.
  const sx = Math.max(0, Math.min(eyeX - cropW / 2, imgW - cropW));
  const sy = Math.max(0, Math.min(eyeY - EYE_LINE * cropH, imgH - cropH));

  return { sx, sy, sw: cropW, sh: cropH };
}

/**
 * One call for the print screen: the crop to use, and how it was arrived at.
 *
 * Never throws. `source` says what happened, so the UI can flag the photos that
 * want a human eye instead of silently printing a badly framed card.
 *   "face"   - a face was found and framed
 *   "center" - nothing found, centred crop, needs checking
 *   "error"  - the model could not run, centred crop, needs checking
 *
 * `plausible` is the more useful signal of the two when source is "face": the
 * model's own score stays high on things that are not faces at all.
 */
export async function autoFrame(image) {
  const imgW = image.naturalWidth || image.width;
  const imgH = image.naturalHeight || image.height;
  const fallback = () => coverCrop(imgW, imgH);

  try {
    const face = await detectFace(image);
    if (!face) return { crop: fallback(), face: null, source: "center", confidence: 0, plausible: false, reasons: [] };
    const { plausible, reasons } = faceLooksPlausible(face);
    return {
      crop: frameFromFace(face, imgW, imgH),
      face,
      source: "face",
      confidence: face.probability,
      plausible,
      reasons,
    };
  } catch (e) {
    return { crop: fallback(), face: null, source: "error", confidence: 0, plausible: false, reasons: [], error: e.message };
  }
}

/**
 * Manual adjustment, for the photos the model gets wrong.
 *
 * `zoom` above 1 tightens the crop, `panX`/`panY` shift it as a fraction of the
 * crop's own size, so the controls feel the same whatever the photo's
 * resolution. The result is always clamped back inside the image.
 */
export function adjustCrop(crop, { zoom = 1, panX = 0, panY = 0 }, imgW, imgH) {
  let sw = crop.sw / zoom;
  let sh = crop.sh / zoom;

  const shrink = Math.min(1, imgW / sw, imgH / sh);
  sw *= shrink;
  sh *= shrink;

  const cx = crop.sx + crop.sw / 2 + panX * sw;
  const cy = crop.sy + crop.sh / 2 + panY * sh;

  return {
    sx: Math.max(0, Math.min(cx - sw / 2, imgW - sw)),
    sy: Math.max(0, Math.min(cy - sh / 2, imgH - sh)),
    sw,
    sh,
  };
}
