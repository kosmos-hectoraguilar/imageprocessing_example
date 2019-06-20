import cv from "@mjyc/opencv.js";

const FPS = 5;
const LOW_BRIGHTNESS_LIMIT = 80;
const HIGH_BRIGHTNESS_LIMIT = 200;

const H_INCHES = 2.23;
const W_INCHES = 3.38;
const DPI_LIMIT = 300;

//let alert = document.getElementById("alert-camera");
//alert.style.visibility = "hidden";

var snapButton = document.querySelector("#icon-flex");

snapButton.addEventListener("click", function(e) {
  let video = document.getElementById("videoInput");
  var image = document.querySelector("#canvasPhoto");
  e.preventDefault();

  var snap = takeSnapshot();

  // Show image.
  image.setAttribute("src", snap);
  image.classList.add("visible");

  // Pause video playback of stream.
  video.pause();
});

function takeSnapshot() {
  let video = document.getElementById("videoInput");
  // Here we're using a trick that involves a hidden canvas element.
  var hidden_canvas = document.querySelector("canvas"),
    context = hidden_canvas.getContext("2d");

  var width = video.videoWidth,
    height = video.videoHeight;

  if (width && height) {
    // Setup a canvas with the same dimensions as the video.
    hidden_canvas.width = width;
    hidden_canvas.height = height;

    // Make a copy of the current frame in the video on the canvas.
    context.drawImage(video, 0, 0, width, height);

    var photo_focus = document.getElementById("photo-focus");
    let srcFinal = cv.imread("canvasPhoto");
    let dst = new cv.Mat();
    // You can try more different parameters
    //let rect = new cv.Rect(100, 100, 200, 200);

    let ratio = Math.min(
      video.videoWidth / video.width,
      video.videoHeight / video.height
    );

    var reductionX = (video.width * ratio - video.videoWidth) / 2;
    var reductionY = (video.height * ratio - video.videoHeight) / 2;

    let rect = new cv.Rect(
      photo_focus.getBoundingClientRect().x * ratio - reductionX,
      photo_focus.getBoundingClientRect().y * ratio - reductionY,
      350 * ratio,
      220 * ratio
    );
    dst = srcFinal.roi(rect);
    cv.imshow("canvasPhoto", dst);
    src.delete();
    dst.delete();

    // Turn the canvas image into a dataURL that can be used as a src for our photo.
    return hidden_canvas.toDataURL("image/png");
  }
}

let cap;
let src;
let reducedMap;
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices
    .getUserMedia({
      video: {
        facingMode: { exact: "environment" }
      } /*{
        width: { ideal: 1280 },
        height: { ideal: 1024 }
      }*/,
      audio: false
    })
    .then(function(stream) {
      let video = document.getElementById("videoInput");
      video.srcObject = stream;
      video.play();
      //video.height = window.outerHeight;
      video.width = window.outerWidth + 50;

      src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
      cap = new cv.VideoCapture(video);

      let { width, height } = stream.getTracks()[0].getSettings();
      let pointCount = video.height * video.width;
      console.log(`${width}x${height}`);

      //video.width = width;
      //video.height = height;

      function processVideo() {
        try {
          //let begin = Date.now();
          writeDateTime();

          cap.read(src);
          reducedMap = new cv.Mat(height / 2, width / 2, cv.CV_8UC4);
          cv.resize(
            src, // input image
            reducedMap, // result image
            reducedMap.size(), // new dimensions
            0,
            0,
            cv.INTER_CUBIC // interpolation method
          );
          //src.delete();

          let brightness = calculateBrightness(
            reducedMap,
            (width / 2) * (height / 2)
          );
          let laplace = blurInput(reducedMap);
          reducedMap.delete();

          //let alert = document.getElementById("alert-camera");
          var element = document.getElementById("photo-button");

          if (
            brightness > HIGH_BRIGHTNESS_LIMIT ||
            brightness < LOW_BRIGHTNESS_LIMIT //||
            //laplace < 80
          ) {
            //alert.style.visibility = "visible";
            element.classList.add(".icon-deseable");
            //document.getElementById("alert-text").innerHTML =
            //"variance:" + laplace + " - brightness:" + brightness;
          } else {
            //alert.style.visibility = "hidden";
            element.classList.remove(".icon-deseable");
          }
          setTimeout(processVideo, 1000 / FPS);
        } catch (err) {
          console.log("An error occurred! " + err);
          setTimeout(processVideo, 1000 / FPS);
        }
      }
      let delay = 1000 / FPS;
      //setInterval(processVideo, delay);
      setTimeout(processVideo, 1000 / FPS);
    });
} else {
  //document.getElementById("alert-text").innerHTML = "Navegador no soportado";
  //alert.style.visibility = "visible";
}

/**
 * Convert the RGB matrix into a HLS one, move into all rows and cols and sum the L component of each
 * element. After it divides the brightness value and pointCount value.
 *
 * @param {Mat} src Matrix that has a definition of the frame to analyze
 * @param {Number} pointCount It is the value of width times height
 * @returns
 */
let dstBrightness;
let rowMat;
let brightness;
let row;
let col;
function calculateBrightness(src, pointCount) {
  dstBrightness = new cv.Mat();
  brightness = 0;
  cv.cvtColor(src, dstBrightness, cv.COLOR_RGB2HLS);

  for (row = 0; row < dstBrightness.rows; row = row + 10) {
    rowMat = dstBrightness.row(row);
    for (col = 0; col < dstBrightness.cols; col = col + 10) {
      brightness = brightness + rowMat.col(col).data[1];
    }
  }
  dstBrightness.delete();

  brightness = (brightness * 100) / pointCount;
  return brightness;
}

var dstBlur;
var temp;
function blurInput(src) {
  writeDateTime();

  dstBlur = new cv.Mat();
  //let src = cv.imread(inputElement);
  //let src = cv.matFromImageData(e.target.result);

  cv.cvtColor(src, dstBlur, cv.COLOR_BGRA2GRAY);
  temp = new cv.Mat();
  resize_300_dpi(dstBlur, temp);
  let lap_variance = laplace_variance(temp);
  //cv.imshow(outputElement, dst);
  dstBlur.delete();
  temp.delete();

  return lap_variance;
}

let lap;
let myMean;
let myStddev;
function laplace_variance(img) {
  let lap_var;
  lap = new cv.Mat();
  myMean = new cv.Mat();
  myStddev = new cv.Mat();

  cv.Laplacian(img, lap, cv.CV_64F);
  cv.meanStdDev(lap, myMean, myStddev);
  lap_var = myStddev.data64F[0] * myStddev.data64F[0];
  lap.delete();
  myMean.delete();
  myStddev.delete();

  return lap_var;
}

function resize_300_dpi(img, img_dst) {
  //let interpoletionMethod;
  let dsize = new cv.Size(1014, 636);
  let h_dpi = img.size().height / H_INCHES;
  let w_dpi = img.size().width / W_INCHES;

  if (h_dpi < DPI_LIMIT || w_dpi < DPI_LIMIT) {
    //interpoletionMethod = cv.INTER_CUBIC;
    cv.resize(img, img_dst, dsize, 0, 0, cv.INTER_CUBIC);
  } else {
    //interpoletionMethod = cv.INTER_AREA;
    cv.resize(img, img_dst, dsize, 0, 0, cv.INTER_AREA);
  }
  //cv.resize(img, img_dst, dsize, 0, 0, interpoletionMethod);
  writeDateTime();

  return img_dst;
}

function writeDateTime() {
  var today = new Date();
  console.log(
    today.getHours() +
      ":" +
      today.getMinutes() +
      ":" +
      today.getSeconds() +
      "." +
      today.getMilliseconds() +
      "\n"
  );
}
