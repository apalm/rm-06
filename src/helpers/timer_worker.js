// The MIT License (MIT)

// Copyright (c) 2014 Chris Wilson

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// https://github.com/cwilso/metronome/blob/master/js/metronomeworker.js
// https://www.html5rocks.com/en/tutorials/audio/scheduling/
// https://github.com/facebook/create-react-app/issues/1277#issuecomment-283147634
// https://github.com/facebook/create-react-app/issues/1277#issuecomment-292708809

function worker_code() {
  let timer_id = null;
  let interval = 100;

  // eslint-disable-next-line no-restricted-globals
  self.onmessage = function(e) {
    if (e.data === "START") {
      timer_id = setInterval(() => {
        postMessage("TICK");
      }, interval);
    } else if (e.data === "STOP") {
      clearInterval(timer_id);
      timer_id = null;
    } else if (e.data.interval) {
      interval = e.data.interval;
      if (timer_id) {
        clearInterval(timer_id);
        timer_id = setInterval(() => {
          postMessage("TICK");
        }, interval);
      }
    }
  };
}

let code = worker_code.toString();
code = code.substring(code.indexOf("{") + 1, code.lastIndexOf("}"));

const blob = new Blob([code], { type: "application/javascript" });

export default URL.createObjectURL(blob);
