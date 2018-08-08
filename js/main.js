$(function() {

  function gup (name) {
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
    var results = regex.exec(window.location.href);
    return (results === null) ? "" : decodeURIComponent(results[1]);
  }

  // Constants
  var MARGIN = 16, TILESIZE = 60, EPS = 2, TILEBORDER = 3;
  var numRows = 8, numCols = 7;
  var debug = (gup("debug") === "true");

  var sprite, banner, audioCtx, songBuffer, intervals;

  function loadResources(callback) {
    $('<div id=loading>').addClass('banner').appendTo('#frame')
      .html('<p><b>Loading ...</b></p>'
         + '<p id=numResoucesLeft></p>');
    // First, check Web Audio
    if (typeof AudioContext !== "undefined") {
      audioCtx = new AudioContext();
    } else if (typeof webkitAudioContext !== "undefined") {
      audioCtx = new webkitAudioContext();
    } else {
      $('<div>').addClass('banner')
        .html('<p>Your web browser does not support Web Audio.</p>'
            + '<p>Please use one of these '
            + '<a href="http://caniuse.com/#feat=audio-api" target="_blank">'
            + 'supported browsers</a>.</p>')
        .appendTo('#frame')
        .hide().fadeIn();
      return;
    }
    // Also check screen resolution
    if (($(window).width() < 452 + TILESIZE * 2 ||
         $(window).height() < 512) && !debug) {
      $('<div>').addClass('banner')
        .html('<p>Your screen is too small.</p>'
            + '<p>Please use a larger device.</p>')
        .appendTo('#frame')
        .hide().fadeIn();
      return;
    }
    // Load resources asynchronously
    var numResoucesLeft = 0;
    function decrement() {
      numResoucesLeft--;
      $('#numResoucesLeft')
        .html('<b>' + numResoucesLeft + '</b> resouces left.');
      if (numResoucesLeft === 0) {
        showSoundTest(callback);
      }
    }
    // Load sprite
    sprite = new Image();
    sprite.onload = decrement;
    sprite.src = 'css/sprite.png';
    numResoucesLeft++;
    // Load banner
    banner = new Image();
    banner.onload = decrement;
    banner.src = 'css/banner.png';
    numResoucesLeft++;
    // Load song
    var request = new XMLHttpRequest();
    request.open("GET", 'song/song.mp3', true);
    request.responseType = "arraybuffer";
    request.onload = function () {
      audioCtx.decodeAudioData(request.response, function (buffer) {
        songBuffer = buffer;
        decrement();
      });
    };
    request.send();
    numResoucesLeft++;
    // Load intervals
    $.getJSON('song/intervals.json', function (data) {
      intervals = data;
      decrement();
    });
    numResoucesLeft++;
  }

  // Create piece (draggable divs)
  function createPiece(i, j) {
    var y = -MARGIN-TILESIZE * i, x = -MARGIN-TILESIZE * j;
    var top = Math.random() * ($("#frame").height() - TILESIZE - 20) + 10;
    var left = (Math.random() *
      (($(window).width() - $("#frame").width()) / 2 - TILESIZE - 20)) + 10;
    var side = Math.random() > .5 ? 'right' : 'left';
    var piece = $('<div>').addClass('piece')
      .css({
        'background-position': '' + x + 'px ' + y + 'px',
        'top': top,
      }).css(side, left)
      .attr('data-i', i).attr('data-j', j).hide()
      .appendTo('body');
    return piece;
  }

  function isValidTile(i, j) {
    return !(i == 2 && j == 6) && !(i == 7 && j == 6);
  }

  var pieces = [];
  function preparePieces() {
    var i, j;
    for (i = 0; i < numRows; i++) {
      var pieceRow = [];
      for (j = 0; j < numCols; j++) {
        if (isValidTile(i, j))
          pieceRow.push(createPiece(i, j));
      }
      pieces.push(pieceRow);
    }
    $('.piece').fadeIn();
    $('#message').text('' + remaining + ' remaining');
    attachListeners();
  }

  loadResources(preparePieces);
  
  var maxZIndex = 5, currentOffsetX, currentOffsetY;
  var remaining = numRows * numCols - 2;

  function attachListeners() {
    $("body").on("mousedown touchstart", ".piece", function (e) {
      var piece = $(this);
      maxZIndex++;
      var s = (e.originalEvent.targetTouches ? 
        e.originalEvent.targetTouches[0] : e);
      currentOffsetX = piece.offset().left - s.pageX;
      currentOffsetY = piece.offset().top - s.pageY;
      piece.css('z-index', maxZIndex).addClass("draggable");
    }).on("mouseup touchend", ".piece", function (e) {
      var piece = $(this);
      if (piece.hasClass("draggable")) {
        piece.removeClass("draggable");
        snap(piece);
      }
    });

    $("body").on("mousemove touchmove", function (e) {
      var s = (e.originalEvent.targetTouches ? 
        e.originalEvent.targetTouches[0] : e);
      var x = Math.min(Math.max(
          s.pageX + currentOffsetX,
          $(window).scrollLeft()),
        $(window).scrollLeft() + $(window).width()
          - TILESIZE - TILEBORDER * 2);
      var y = Math.min(Math.max(
          s.pageY + currentOffsetY,
          $(window).scrollTop()),
        $(window).scrollTop() + $(window).height()
          - TILESIZE - TILEBORDER * 2);
      $(".draggable").offset({
        'top': y, 'left': x
      });
      e.preventDefault();
    }).on("mouseup touchend", function (e) {
      $(".piece.draggable").each(function (i, piece) {
        $(piece).removeClass("draggable");
        snap($(piece));
      });
    });
  }

  function snap(piece) {
    var i = +piece.attr('data-i'), j = +piece.attr('data-j');
    var o = piece.offset();
    var relI = (o.top + TILEBORDER 
        - $('#frame').offset().top - MARGIN) / TILESIZE;
    var relJ = (o.left + TILEBORDER
        - $('#frame').offset().left - MARGIN) / TILESIZE;
    var intI = Math.round(relI), intJ = Math.round(relJ);
    if (intI < 0 || intI >= numRows) return;
    if (intJ < 0 || intJ >= numCols) return;
    if (Math.abs(intI - relI) < EPS &&
        Math.abs(intJ - relJ) < EPS) {
      var correct = (intI == i && intJ == j);
      // Snap
      piece.offset({
        'top': ($('#frame').offset().top + MARGIN
                + intI * TILESIZE - TILEBORDER),
        'left': ($('#frame').offset().left + MARGIN
                + intJ * TILESIZE - TILEBORDER)
      });
      if (correct) placePiece(piece);
      if (debug) {
        // Put everything into place
        $('.piece').each(function (idx, x) {
          placePiece($(x));
        });
      }
    }
  }

  function placePiece(piece) {
    var i = +piece.attr('data-i'), j = +piece.attr('data-j');
    piece.removeClass("piece").addClass("placed")
      .css('z-index', 0).appendTo('#frame')
      .css({
        'top': MARGIN + i * TILESIZE,
        'left': MARGIN + j * TILESIZE
      });
    remaining--;
    $('#message').text('' + remaining + ' remaining');
    if (remaining < 10) {
      // Flash the remaining tiles
      $('.piece').addClass('flashing');
      window.setTimeout(function () {
        $('.piece').removeClass('flashing');
      }, 300);
    }
    if (remaining == 0) {
      $('#message').text('');
      playSongOnce();
    }
  }

  function playSongOnce() {
    $("#frame").addClass("song-stopped");
    $(".placed").addClass("faded");
    var i, j;
    var fns = [];    // This is so ugly ...
    for (i = numRows - 1; i >= 0; i--) {
      for (j = numCols - 1; j >= 0; j--) {
        if (!isValidTile(i, j)) continue;
        fns.push((function (i, j, f) {
          return function () {
            pieces[i][j].removeClass('faded');
            playTile(i, j, f);
          };
        })(i, j, fns.length === 0 ? showBanner : fns[fns.length - 1]));
      }
    }
    fns[fns.length - 1]();
  }

  function showBanner() {
    var banner = $('<div>').addClass('banner')
      .append($('<img>').attr('src', 'css/banner.png'))
      .append($('<p>ขอให้น้องออยมีความสุข</p>'))
      .append($('<p>ประสบความสำเร็จ ตลอดปีและตลอดไป</p>'))
      .append($('<p>- พี่ไอซ์</p>'))
      .append($('<p>(แตะแต่ละช่องเพื่อฟังเพลง)</p>'))
      .append($('<button>').text('OK').on("click", function () {
        $('.banner').fadeOut();
        prepareSong();
      }))
      .hide().fadeIn()
      .appendTo('#frame');
  }

  function prepareSong() {
    $("body").on("click tap", ".song-stopped .placed", function (e) {
      var piece = $(this);
      var i = piece.attr('data-i'), j = piece.attr('data-j');
      pieces[i][j].addClass('current');
      playTile(i, j, function () {
        pieces[i][j].removeClass('current');
      });
    });
  }

  function playTile(i, j, callback) {
    playSound(intervals[i][j][0], intervals[i][j][1], callback);
  }

  function playSound(start, stop, callback) {
    var source = audioCtx.createBufferSource();
    source.buffer = songBuffer;
    source.connect(audioCtx.destination);
    source.onended = function () {
      $("#frame").removeClass("song-playing").addClass("song-stopped");
      callback();
    };
    $("#frame").removeClass("song-stopped").addClass("song-playing");
    source.start(0, start, stop - start);
  }

  var testStart = 37.93, testEnd = 38.75;

  function showSoundTest(callback) {
    var soundButton = $('<button>').text('ทดสอบเสียง')
      .on("click tap", function (e) {
        soundButton.attr('disabled', true);
        playSound(testStart, testEnd, function () {
          soundButton.attr('disabled', false);
          okButton.attr('disabled', false);
        });
      });
    var okButton = $('<button disabled>').text('OK')
      .on("click tap", function (e) {
        $('#loading').fadeOut();
        $("#frame").removeClass("song-stopped");
        callback();
      });
    $('#loading')
      .append($('<p>').append(soundButton))
      .append($('<p>').append('ถ้าไม่ได้ยิน เช็คระดับเสียง แล้ว refresh'))
      .append($('<p>').append(okButton));
  }

});
