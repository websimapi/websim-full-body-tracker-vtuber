// Main script for the Full Body Tracker VTuber

// Global variables
let video, canvas, ctx;
let pose = null;
let poseNet = null;
let trailingEnabled = false;
let lastBgChange = 0;
let lastTrailToggle = 0;
const GESTURE_COOLDOWN = 1000; // milliseconds cooldown for gesture triggers
let bgColor = "#222";

// Set up skeleton connections (using PoseNet keypoint names)
const skeletonConnections = [
  ["leftShoulder", "rightShoulder"],
  ["leftShoulder", "leftElbow"],
  ["leftElbow", "leftWrist"],
  ["rightShoulder", "rightElbow"],
  ["rightElbow", "rightWrist"],
  ["leftShoulder", "leftHip"],
  ["rightShoulder", "rightHip"],
  ["leftHip", "rightHip"],
  ["leftHip", "leftKnee"],
  ["leftKnee", "leftAnkle"],
  ["rightHip", "rightKnee"],
  ["rightKnee", "rightAnkle"],
  ["nose", "leftEye"],
  ["nose", "rightEye"],
  ["leftEye", "leftEar"],
  ["rightEye", "rightEar"]
];

// Utility: Convert hex color to rgba string with provided alpha
function hexToRgba(hex, alpha) {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h.split("").map(c => c + c).join("");
  }
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Utility: Generate a random hex color
function randomColor() {
  const color = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0");
  return `#${color}`;
}

// Initialize video, canvas, and PoseNet
function init() {
  video = document.getElementById("video");
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");

  // Set canvas dimensions to window size
  resizeCanvas();

  // Set up webcam stream
  navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then(stream => {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        // Initialize PoseNet after video starts
        poseNet = ml5.poseNet(video, modelReady);
        poseNet.on("pose", results => {
          if (results.length > 0) {
            pose = results[0].pose;
          }
        });
      };
    })
    .catch(err => {
      console.error("Error accessing webcam:", err);
    });

  // Listen for window resize
  window.addEventListener("resize", resizeCanvas);

  // Start the drawing loop
  requestAnimationFrame(drawLoop);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// Called when PoseNet model is loaded
function modelReady() {
  console.log("PoseNet model loaded.");
}

// Main drawing loop
function drawLoop() {
  // If video metadata is available, compute scaling factors for pose coordinates
  const vW = video.videoWidth || 640;
  const vH = video.videoHeight || 480;
  const scaleX = canvas.width / vW;
  const scaleY = canvas.height / vH;

  // Clear or fade the canvas based on trailing setting
  if (trailingEnabled) {
    // Fill with semi-transparent rectangle in the bgColor to create trailing effect
    ctx.fillStyle = hexToRgba(bgColor, 0.1);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    // Completely clear the canvas (since the page background shows through)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Process gestures if a valid pose is available
  if (pose) {
    processGestures();
    // Draw the skeleton with mirror effect
    drawSkeleton(scaleX, scaleY);
  }

  requestAnimationFrame(drawLoop);
}

// Draw the pose skeleton and keypoints with mirrored video coordinates
function drawSkeleton(scaleX, scaleY) {
  // Save current state and mirror the drawing horizontally
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-scaleX, scaleY);

  // Draw skeleton segments
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#FFD700";
  skeletonConnections.forEach(connection => {
    const partA = connection[0];
    const partB = connection[1];
    const pointA = getKeypoint(pose, partA);
    const pointB = getKeypoint(pose, partB);
    if (pointA && pointB && pointA.score > 0.5 && pointB.score > 0.5) {
      ctx.beginPath();
      ctx.moveTo(pointA.position.x, pointA.position.y);
      ctx.lineTo(pointB.position.x, pointB.position.y);
      ctx.stroke();
    }
  });

  // Draw keypoints
  pose.keypoints.forEach(keypoint => {
    if (keypoint.score > 0.5) {
      ctx.beginPath();
      ctx.arc(keypoint.position.x, keypoint.position.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "#FF6347";
      ctx.fill();
    }
  });

  ctx.restore();
}

// Helper: Get keypoint by part name from a pose
function getKeypoint(pose, partName) {
  return pose.keypoints.find(kp => kp.part === partName);
}

// Process gesture controls: left hand for background, right hand for trailing toggle.
// A simple gesture: if hand wrist Y coordinate is above the nose Y coordinate by a margin.
function processGestures() {
  const now = Date.now();
  const nose = getKeypoint(pose, "nose");
  const leftWrist = getKeypoint(pose, "leftWrist");
  const rightWrist = getKeypoint(pose, "rightWrist");
  const GESTURE_MARGIN = 20; // pixels margin

  if (nose && leftWrist && leftWrist.score > 0.5 && nose.score > 0.5) {
    if (leftWrist.position.y < nose.position.y - GESTURE_MARGIN &&
        (now - lastBgChange > GESTURE_COOLDOWN)) {
      // Change background color
      bgColor = randomColor();
      document.body.style.backgroundColor = bgColor;
      lastBgChange = now;
      console.log("Background color changed to", bgColor);
    }
  }

  if (nose && rightWrist && rightWrist.score > 0.5 && nose.score > 0.5) {
    if (rightWrist.position.y < nose.position.y - GESTURE_MARGIN &&
        (now - lastTrailToggle > GESTURE_COOLDOWN)) {
      // Toggle trailing effect
      trailingEnabled = !trailingEnabled;
      lastTrailToggle = now;
      updateTrailingStatus();
      console.log("Trailing toggled. Now:", trailingEnabled);
    }
  }
}

// Update the trailing status text in the instructions div.
function updateTrailingStatus() {
  const statusText = document.getElementById("trailing-status");
  statusText.textContent = `Trailing: ${trailingEnabled ? "ON" : "OFF"}`;
}

// Initialize the app once the window loads
window.addEventListener("load", init);