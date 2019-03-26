// https://github.com/facebook/create-react-app/issues/1277#issuecomment-283147634
// https://github.com/facebook/create-react-app/issues/1277#issuecomment-292708809
function workerCode() {
  let timerID = null;
  let interval = 100;

  // eslint-disable-next-line no-restricted-globals
  self.onmessage = function(e) {
    if (e.data === "START") {
      timerID = setInterval(() => {
        postMessage("TICK");
      }, interval);
    } else if (e.data.interval) {
      interval = e.data.interval;
      if (timerID) {
        clearInterval(timerID);
        timerID = setInterval(() => {
          postMessage("TICK");
        }, interval);
      }
    } else if (e.data === "STOP") {
      clearInterval(timerID);
      timerID = null;
    }
  };
}

let code = workerCode.toString();
code = code.substring(code.indexOf("{") + 1, code.lastIndexOf("}"));

const blob = new Blob([code], { type: "application/javascript" });

export default URL.createObjectURL(blob);
