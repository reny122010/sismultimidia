 <!-- script section -->
    'use strict'
    
    var file; 
    var type; 
    var codecs; 
    var width;  
    var height;

    var videoElement = document.getElementById('myVideo');
    var play = document.getElementById("load");
    console.log(videoElement);
    videoElement.poster = "img/wallpaper.jpg";

    var initialization;
    var segDuration;
    var vidDuration;

    var bandwidth; 

    var index = 0;
    var segments;
    var curIndex = document.getElementById("curIndex"); 
    var segLength = document.getElementById("segLength");



    var segCheck;
    var lastTime = 0;
    var bufferUpdated = false;

    var mediaSource;
    var videoSource;
    // Flags to keep things going 
    var lastMpd = "";
    var vTime = document.getElementById("curTime");
    var requestId = 0;

    // Click event handler for load button    
    play.addEventListener("click", function () {
      if (videoElement.paused == true) {
        console.log(document.getElementById("filename").value);
        var curMpd = document.getElementById("filename").value;
        if (curMpd != lastMpd) {
          window.cancelAnimationFrame(requestId);
          lastMpd = curMpd;
          getData(curMpd);
        } else {
          videoElement.play();
        }
      } else {
        videoElement.pause();
      }
    }, false);

    videoElement.addEventListener("click", function () {
      play.click();
    }, false);

    document.getElementById("myVideo").addEventListener("error", function (e) {
      log("video error: " + e.message);
    }, false);

    function getData(url) {
      if (url !== "") {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);           
        xhr.responseType = "text"; 
        xhr.send();

       
        xhr.onreadystatechange = function () {
          if (xhr.readyState == xhr.DONE) {
            var tempoutput = xhr.response;
            var parser = new DOMParser();

            var xmlData = parser.parseFromString(tempoutput, "text/xml", 0);
            log("parsing mpd file");
            getFileType(xmlData);
            setupVideo();
            clearVars();
          }
        }

        xhr.addEventListener("error", function (e) {
          log("Error: " + e + " Could not load url.");
        }, false);
      }
    }

    function getFileType(data) {
      try {
        file = data.querySelectorAll("BaseURL")[0].textContent.toString();
        var attribute = data.querySelectorAll("Representation");
        type = attribute[0].getAttribute("mimeType");
        codecs = attribute[0].getAttribute("codecs");
        width = attribute[0].getAttribute("width");
        height = attribute[0].getAttribute("height");
        bandwidth = attribute[0].getAttribute("bandwidth");

        var ini = data.querySelectorAll("Initialization");
        initialization = ini[0].getAttribute("range");
        segments = data.querySelectorAll("SegmentURL");

        var period = data.querySelectorAll("Period");
        var vidTempDuration = period[0].getAttribute("duration");
        vidDuration = parseDuration(vidTempDuration);

        var segList = data.querySelectorAll("SegmentList");
        segDuration = segList[0].getAttribute("duration");

      } catch (er) {
        log(er);
        return;
      }
      showTypes();
    }

    function showTypes() {
      var display = document.getElementById("myspan");
      var spanData;
      spanData = "<h3>Informações do vídeo:</h3><ul><li>Arquivo: " + file + "</li>";
      spanData += "<li>Tipo: " + type + "</li>";
      spanData += "<li>Codecs: " + codecs + "</li>";
      spanData += "<li>Width: " + width + " -- Height: " + height + "</li>";
      spanData += "<li>Bandwidth: " + bandwidth + "</li>";
      spanData += "<li>Initialization Range: " + initialization + "</li>";
      spanData += "<li>Segment length: " + segDuration / 1000 + " seconds</li>";
      spanData += "<li>" + vidDuration + "</li>";
      spanData += "</ul>";
      display.innerHTML = spanData;
      document.getElementById("numIndexes").innerHTML = segments.length;
      document.getElementById("curInfo").style.display = "block";
      document.getElementById("curInfo").style.display = "block";
    }


    function render() {
      vTime.innerText = formatTime(videoElement.currentTime);
      // Recall this function when available 
      requestId = window.requestAnimationFrame(render);
    }
 
    function setupVideo() {
      clearLog();

      if (window.MediaSource) {
        mediaSource = new window.MediaSource();
       } else {
        log("mediasource or syntax not supported");
        return;
      }
      var url = URL.createObjectURL(mediaSource);
      videoElement.pause();
      videoElement.src = url;
      videoElement.width = width;
      videoElement.height = height;

      mediaSource.addEventListener('sourceopen', function (e) {
        try {
          videoSource = mediaSource.addSourceBuffer('video/mp4');
          initVideo(initialization, file);           
        } catch (e) {
          log('Exception calling addSourceBuffer for video', e);
          return;
        }
      },false);

      videoElement.addEventListener("pause", function () {
        play.innerText = "Play";
      }, false);

      videoElement.addEventListener("playing", function () {
        play.innerText = "Pause";
      }, false);

      videoElement.addEventListener("ended", function () {
        videoElement.removeEventListener("timeupdate", checkTime);
      }, false);
    }

    function initVideo(range, url) {
      var xhr = new XMLHttpRequest();
      if (range || url) {

        xhr.open('GET', url);
        xhr.setRequestHeader("Range", "bytes=" + range);
        segCheck = (timeToDownload(range) * .8).toFixed(3); 
        xhr.send();
        xhr.responseType = 'arraybuffer';
        try {
          xhr.addEventListener("readystatechange", function () {
             if (xhr.readyState == xhr.DONE) { 
              try {
                videoSource.appendBuffer(new Uint8Array(xhr.response));
                videoSource.addEventListener("update",updateFunct, false);

              } catch (e) {
                log('Exception while appending initialization content', e);
              }
            }
          }, false);
        } catch (e) {
          log(e);
        }
      } else {
        return
      }
    }
    
    function updateFunct() {
      bufferUpdated = true;
      getStarted(file);
      videoSource.removeEventListener("update", updateFunct);
    }

    function getStarted(url) {
      playSegment(segments[index].getAttribute("mediaRange").toString(), url);

      requestId = window.requestAnimationFrame(render);

      curIndex.textContent = index + 1;
      index++;

      videoElement.addEventListener("timeupdate", fileChecks, false);

    }
    //  Get video segments 
    function fileChecks() {
      if (bufferUpdated == true) {
        if (index < segments.length) {
          if ((videoElement.currentTime - lastTime) >= segCheck) {
            playSegment(segments[index].getAttribute("mediaRange").toString(), file);
            lastTime = videoElement.currentTime;
            curIndex.textContent = index + 1;    
            index++;
          }
        } else {
          videoElement.removeEventListener("timeupdate", fileChecks, false);
        }
      }
    }

    function playSegment(range, url) {
      var xhr = new XMLHttpRequest();
      if (range || url) { 
        xhr.open('GET', url);
        xhr.setRequestHeader("Range", "bytes=" + range);
        xhr.send();
        xhr.responseType = 'arraybuffer';
        try {
          xhr.addEventListener("readystatechange", function () {
            if (xhr.readyState == xhr.DONE) { 
                segCheck = (timeToDownload(range) * .8).toFixed(3); 
                segLength.textContent = segCheck;
              try {
                videoSource.appendBuffer(new Uint8Array(xhr.response));
              } catch (e) {
                log('Exception while appending', e);
              }
            }
          }, false);
        } catch (e) {
          log(e);
          return 
        }
      }
    }

    function log(s) {
      console.log(s);
    };

    function clearLog() {
      console.clear();
    }

    function clearVars() {
      index = 0;
      lastTime = 0;
    }

    function timeToDownload(range) {
      var vidDur = range.split("-");
      return (((vidDur[1] - vidDur[0]) * 8) / bandwidth)
    }

    function parseDuration(pt) {
      var ptTemp = pt.split("T")[1];
      ptTemp = ptTemp.split("H")
      var hours = ptTemp[0];
      var minutes = ptTemp[1].split("M")[0];
      var seconds = ptTemp[1].split("M")[1].split("S")[0];
      var hundredths = seconds.split(".");
      return "Video length: " + hours + ":" + pZ(minutes, 2) + ":" + pZ(hundredths[0], 2) + "." + hundredths[1];

    }


    function formatTime(timeSec) {
      var seconds = timeSec % 60;                                                
      var minutes = ((timeSec - seconds) / 60) % 60;              
      var hours = ((timeSec - seconds - (minutes * 60))) / 3600; 
      seconds = seconds.toFixed(2);
      var dispSeconds = seconds.toString().split(".");
      return (pZ(hours, 2) + ":" + pZ(minutes, 2) + ":" + pZ(dispSeconds[0], 2) + "." + pZ(dispSeconds[1], 2));
    }

    function pZ(value, padCount) {
      var tNum = value + '';
      while (tNum.length < padCount) {
        tNum = "0" + tNum;
      }
      return tNum;
    }