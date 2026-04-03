(function() {
  var animate, anims, baseOutset, baseOutsetPuzzle, charKern, charSpace, drawBase, drawLetter, drawPiece, furls, getOffset, headRoom, horizDelay, lineKern, loopDelay, margin, normalStatus, now, orderLetter, pieceDelay, recording, resize, rotateDelay, round, simulate, sleep, speed, statusGIF, svg, svgExplicit, svgPrefixId, sync, timeout, updateLink, updateSpeed, updateText, vertDelay, waiting,
    indexOf = [].indexOf;

  margin = 1.1; // for I + stroke to not fall outside

  baseOutset = 0.9; // smaller than 1 to avoid overlapping stroke-linecap

  baseOutsetPuzzle = 1.1; // larger than to guarantee overlap

  charKern = function(state) {
    if (state.puzzle) {
      return 2;
    } else {
      return 1;
    }
  };

  charSpace = function(state) {
    if (state.puzzle) {
      return 4;
    } else {
      return 3;
    }
  };

  lineKern = function(state) {
    //if state.anim
    //  0
    //else
    if (state.puzzle) {
      return 4;
    } else {
      return 2;
    }
  };

  headRoom = 3;

  //# All of these delays are divided by 1.2 ** speed,
  //# except for loopDelay which stays long.
  rotateDelay = 0.3;

  horizDelay = 0.3;

  vertDelay = 0.2;

  pieceDelay = 1;

  loopDelay = 2; // in addition to pieceDelay

  furls = null;

  svg = null;

  round = 0;

  now = 0;

  anims = [];

  waiting = [];

  recording = null;

  speed = 0;

  updateSpeed = function(s = furls != null ? furls.getState().speed : void 0) {
    s = parseInt(s);
    if (isNaN(s)) {
      s = 0;
    }
    return speed = 1.2 ** s;
  };

  timeout = function(ms) {
    return new Promise(function(done) {
      return setTimeout(done, ms);
    });
  };

  simulate = async function() {
    var anim, before, i, image, j, len, results;
    if (!recording) {
      return;
    }
    await timeout(0); // wait for all animations to start
    before = now;
    now = Math.min(...((function() {
      var j, len, results;
      results = [];
      for (j = 0, len = anims.length; j < len; j++) {
        anim = anims[j];
        if (!anim.sync) {
          results.push(anim.t);
        }
      }
      return results;
    })()));
    if (now === before) {
      return;
    }
    image = new Image(recording.options.width, recording.options.height);
    await new Promise(function(loaded) {
      var viewbox;
      image.onload = loaded;
      viewbox = svg.viewbox();
      return image.src = `data:image/svg+xml,${      //# Size image to target
svgExplicit(svg)}`.replace(/(width=")[^"]*(")/, `$1${recording.options.width}$2`).replace(/(height=")[^"]*(")/, `$1${//# Add white background (Chrome doesn't seem to respect transparency)
recording.options.height}$2`).replace(/<svg[^<>]*>/, `$&<rect fill="white" x="${viewbox.x}" y="${viewbox.y}" width="${viewbox.width}" height="${viewbox.height}"/>`);
    });
    recording.addFrame(image, {
      copy: true,
      delay: now - before
    });
    results = [];
    for (i = j = 0, len = anims.length; j < len; i = ++j) {
      anim = anims[i];
      if (!(anim.t === now && !anim.sync)) {
        continue;
      }
      anim.advance();
      results.push(anim.advance = null);
    }
    return results;
  };

  sleep = function(delay, myAnim) {
    return new Promise(function(done) {
      delay *= 1000;
      if (recording) {
        anims[myAnim].t += Math.round(delay);
        anims[myAnim].advance = done;
        return simulate();
      } else {
        return setTimeout(function() {
          updateSpeed();
          return done();
        }, delay);
      }
    });
  };

  sync = function(myAnim) {
    return new Promise(function(done) {
      var anim, j, k, len, len1, results, tMax, waiter, waiters;
      //console.log myAnim, anims.length, 'sync', waiting.length
      anims[myAnim].sync = true;
      waiting.push(done);
      if (anims.length === waiting.length) { // everyone has reached sync
        waiters = waiting;
        waiting = [];
        for (j = 0, len = waiters.length; j < len; j++) {
          waiter = waiters[j];
          waiter();
        }
        tMax = Math.max(...((function() {
          var k, len1, results;
          results = [];
          for (k = 0, len1 = anims.length; k < len1; k++) {
            anim = anims[k];
            results.push(anim.t);
          }
          return results;
        })()));
        results = [];
        for (k = 0, len1 = anims.length; k < len1; k++) {
          anim = anims[k];
          anim.t = tMax;
          results.push(anim.sync = false);
        }
        return results;
      } else {
        return simulate();
      }
    });
  };

  animate = async function(group, glyph, state, waitFor = null, onFirstComplete = null) {
    var a, angle, angles, i, j, jobs, k, l, len, len1, m, myAnim, myRound, n, numAnim, piece, pieceIndex, pieceName, polygon, puzzleY, ref, ref1, ref2, ref3, ref4, ref5, rotate, startAngle, startT, startX, startY, transform, x, y;
    myRound = round;
    if (waitFor != null) {
      await waitFor;
      if (round !== myRound) {
        return;
      }
    }
    if (state.seq) {
      // In sequential mode, keep each letter's sync barrier isolated.
      anims = [];
      waiting = [];
    }
    rotate = state.rotate;
    if (state.puzzle) {
      rotate = false;
    }
    myAnim = anims.length;
    numAnim = 1;
    if (state.puzzle) {
      numAnim = glyph.order.length;
    }
    updateSpeed(state.speed);
    startT = state.seq ? now : 0;
    for (i = j = 0, ref = numAnim; (0 <= ref ? j < ref : j > ref); i = 0 <= ref ? ++j : --j) {
      anims.push({
        t: startT,
        advance: null
      });
    }
    while (true) {
      puzzleY = glyph.height - 3;
      jobs = [];
      ref1 = orderLetter(glyph);
      //for pieceName, pieceIndex in glyph.order
      for (pieceIndex = k = 0, len = ref1.length; k < len; pieceIndex = ++k) {
        pieceName = ref1[pieceIndex];
        angle = glyph[pieceName].r;
        if (angle === 270) {
          angle = -90;
        }
        startAngle = (1 - rotate) * angle;
        if (state.puzzle) {
          startX = glyph[pieceName].tx;
          startY = puzzleY;
        } else {
          startX = Math.floor(glyph.width / 2 - 1);
          startY = -headRoom;
        }
        piece = window.pieces[pieceName];
        polygon = drawPiece(group, piece, pieceName, state, transform = {
          rotate: startAngle,
          origin: piece.center,
          translateX: startX,
          translateY: startY
        });
        if (state.puzzle) {
          jobs.push((async function(pieceIndex, startY, polygon, transform) {
            var l, ref2, ref3, y;
            for (y = l = ref2 = startY, ref3 = glyph[pieceName].ty; (ref2 <= ref3 ? l <= ref3 : l >= ref3); y = ref2 <= ref3 ? ++l : --l) {
              if (y !== startY) {
                await sleep(vertDelay / speed, myAnim + pieceIndex);
              }
              if (round !== myRound) {
                return;
              }
              transform.translateY = y;
              polygon.transform(transform);
            }
            await sleep(pieceDelay / speed, myAnim + pieceIndex);
            if (round !== myRound) {
              return;
            }
            return (await sync(myAnim + pieceIndex));
          })(pieceIndex, startY, polygon, transform));
          puzzleY -= 4; // mimic drawLetter in puzzle mode
        } else {
          if (startAngle === 0 && angle === 180) {
            angles = [0, 90, 180];
          } else if (startAngle !== angle) {
            angles = [startAngle, angle];
          } else {
            angles = [startAngle];
          }
          if (angles.length > 1) {
            for (l = 0, len1 = angles.length; l < len1; l++) {
              a = angles[l];
              if (a !== angles[0]) {
                await sleep(rotateDelay / speed, myAnim);
              }
              if (round !== myRound) {
                return;
              }
              transform.rotate = a;
              polygon.transform(transform);
            }
          }
          for (x = m = ref2 = startX, ref3 = glyph[pieceName].tx; (ref2 <= ref3 ? m <= ref3 : m >= ref3); x = ref2 <= ref3 ? ++m : --m) {
            if (x !== startX) {
              await sleep(horizDelay / speed, myAnim);
            }
            if (round !== myRound) {
              return;
            }
            transform.translateX = x;
            polygon.transform(transform);
          }
          for (y = n = ref4 = startY, ref5 = glyph[pieceName].ty; (ref4 <= ref5 ? n <= ref5 : n >= ref5); y = ref4 <= ref5 ? ++n : --n) {
            if (y !== startY) {
              await sleep(vertDelay / speed, myAnim);
            }
            if (round !== myRound) {
              return;
            }
            transform.translateY = y;
            polygon.transform(transform);
          }
          await sleep(pieceDelay / speed, myAnim);
          if (round !== myRound) {
            return;
          }
        }
      }
      if (jobs.length) {
        await Promise.all(jobs);
      } else {
        await Promise.all((function() {
          var o, ref6, results;
          results = [];
          for (i = o = 0, ref6 = numAnim; (0 <= ref6 ? o < ref6 : o > ref6); i = 0 <= ref6 ? ++o : --o) {
            results.push(sync(myAnim + i));
          }
          return results;
        })());
      }
      if (typeof onFirstComplete === "function") {
        onFirstComplete();
      }
      onFirstComplete = null;
      if (state.seq || window.__BIRTHDAY_SINGLE_PASS__) {
        return;
      }
      if (round !== myRound) {
        return;
      }
      await Promise.all((function() {
        var o, ref6, results;
        results = [];
        for (i = o = 0, ref6 = numAnim; (0 <= ref6 ? o < ref6 : o > ref6); i = 0 <= ref6 ? ++o : --o) {
          results.push(sleep(loopDelay, myAnim + i));
        }
        return results;
      })());
      if (round !== myRound) {
        return;
      }
      group.clear();
      drawBase(group, glyph);
      if (recording != null) {
        recording.on('finished', function(blob) {
          var download;
          statusGIF(false, 'Downloading Animated GIF...');
          download = document.getElementById('download');
          download.href = URL.createObjectURL(blob);
          download.download = 'tetris.gif';
          download.click();
          return statusGIF(true, normalStatus);
        });
        statusGIF(false, 'Processing Animated GIF...');
        recording.render();
        recording = null;
      }
    }
  };

  drawBase = function(group, glyph, dy = 0, outset = baseOutset) {
    return group.rect(glyph.width + 2 * outset, 0.5).x(-outset).y(glyph.height + dy).addClass('base');
  };

  drawPiece = function(group, piece, pieceName, state, transform) {
    var container, edge, j, len, polygon, ref;
    //group.polygon piece.polygon
    //.addClass pieceName
    //.transform
    //  translateX: glyph[pieceName].tx
    //  translateY: glyph[pieceName].ty
    if (state.grid || state.center) {
      container = group.group();
    } else {
      container = null;
    }
    polygon = (container != null ? container : group).polygon(piece.polygon).addClass(pieceName);
    if (state.grid) {
      ref = piece.edges;
      for (j = 0, len = ref.length; j < len; j++) {
        edge = ref[j];
        container.line(...edge[0], ...edge[1]);
      }
    }
    //# Rotation center:
    if (state.center) {
      container.circle(0.5).center(...piece.center);
    }
    return (container != null ? container : polygon).transform(transform);
  };

  orderLetter = function(glyph) {
    var dep, deps, droppable, j, k, len, options, order, pieceName, pieceNames, ref, totalPieces, which;
    if (!(glyph != null ? glyph.partial : void 0)) {
      return (glyph != null ? glyph.order : void 0) != null ? glyph.order.slice() : [];
    }
    pieceNames = Object.keys(glyph.partial);
    totalPieces = pieceNames.length;
    order = [];
    for (which = j = 0; j < totalPieces; which = ++j) {
      options = [];
      ref = glyph.partial;
      for (pieceName in ref) {
        deps = ref[pieceName];
        if (!(indexOf.call(order, pieceName) < 0)) {
          continue;
        }
        droppable = true;
        for (k = 0, len = deps.length; k < len; k++) {
          dep = deps[k];
          if (indexOf.call(order, dep) < 0) {
            droppable = false;
          }
        }
        if (droppable) {
          options.push(pieceName);
        }
      }
      if (options.length) {
        order.push(options[Math.floor(Math.random() * options.length)]);
      } else {
        break;
      }
    }
    if (glyph.order) {
      for (j = 0, len = glyph.order.length; j < len; j++) {
        pieceName = glyph.order[j];
        if (indexOf.call(order, pieceName) < 0) {
          order.push(pieceName);
        }
      }
    }
    return order;
  };

  drawLetter = function(char, svg, state, waitFor = null) {
    var done, glyph, group, j, len, piece, pieceName, ref, y;
    group = svg.group();
    glyph = window.font[char];
    y = 0;
    done = Promise.resolve();
    drawBase(group, glyph, (state.puzzle && !state.anim ? -5 : void 0), state.puzzle ? baseOutsetPuzzle : baseOutset);
    if (state.anim) {
      done = new Promise((resolve) => {
        return animate.call(this, group, glyph, state, waitFor, resolve);
      });
      if (state.puzzle) {
        y = -4 * glyph.order.length + glyph.height;
      }
    } else {
      ref = glyph.order;
      for (j = 0, len = ref.length; j < len; j++) {
        pieceName = ref[j];
        piece = window.pieces[pieceName];
        drawPiece(group, piece, pieceName, state, {
          rotate: glyph[pieceName].r,
          origin: piece.center,
          translateX: glyph[pieceName].tx,
          translateY: state.puzzle ? y : glyph[pieceName].ty
        });
        if (state.puzzle) {
          y -= 4;
        }
      }
    }
    return {
      group: group,
      x: 0,
      y: y,
      width: glyph.width,
      done: done,
      height: state.puzzle ? state.anim ? -y + glyph.height - 3 : -y : glyph.height
    };
  };

  updateLink = function(state) {
    var href, link;
    if ((link = document.getElementById('link')) && (href = link.getAttribute('data-href'))) {
      href = href.replace(/TEXT/, state.text);
      return link.setAttribute('href', href);
    }
  };

  updateText = function(changed) {
    var c, char, dy, j, k, l, len, len1, len2, letter, line, prevDone, ref, row, state, waiter, waiters, x, xmax, y;
    state = this.getState();
    updateLink(state);
    //# Allow GIF when animating, unless currently downloading
    statusGIF(state.anim);
    if (!changed.recording) {
      recording = null;
    }
    if (!(changed.text || changed.anim || changed.recording || changed.rotate || changed.puzzle || changed.grid || changed.center || changed.seq)) {
      return;
    }
    round++;
    waiters = waiting;
// clear waiters
    for (j = 0, len = waiters.length; j < len; j++) {
      waiter = waiters[j];
      waiter();
    }
    //await sleep 0
    now = 0;
    anims = [];
    waiting = [];
    svg.clear();
    y = 0;
    xmax = 0;
    prevDone = Promise.resolve();
    ref = state.text.split('\n');
    for (k = 0, len1 = ref.length; k < len1; k++) {
      line = ref[k];
      if (state.anim) {
        y += headRoom;
      }
      x = 0;
      dy = 0;
      row = [];
      for (c = l = 0, len2 = line.length; l < len2; c = ++l) {
        char = line[c];
        char = char.toUpperCase();
        if (char in window.font) {
          if (c !== 0) {
            x += charKern(state);
          }
          if (state.anim && state.seq) {
            letter = drawLetter.call(this, char, svg, state, prevDone);
            prevDone = letter.done;
          } else {
            letter = drawLetter.call(this, char, svg, state);
          }
          letter.group.translate(x - letter.x, y - letter.y);
          row.push(letter);
          x += letter.width;
          xmax = Math.max(xmax, x);
          dy = Math.max(dy, letter.height);
        } else if (char === ' ') {
          x += charSpace(state);
        }
      }
      //# Bottom alignment
      //for letter in row
      //  letter.group.dy dy - letter.height
      y += dy + lineKern(state);
    }
    return svg.viewbox({
      x: -margin,
      y: -margin,
      width: xmax + 2 * margin,
      height: y + 2 * margin
    });
  };

  //# Based on meouw's answer on http://stackoverflow.com/questions/442404/retrieve-the-position-x-y-of-an-html-element
  getOffset = function(el) {
    var x, y;
    x = y = 0;
    while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
      x += el.offsetLeft - el.scrollLeft;
      y += el.offsetTop - el.scrollTop;
      el = el.offsetParent;
    }
    return {
      x: x,
      y: y
    };
  };

  resize = function() {
    var height, offset;
    offset = getOffset(document.getElementById('output'));
    height = Math.max(100, window.innerHeight - offset.y);
    height -= parseInt(window.getComputedStyle(document.body).marginBottom);
    return document.getElementById('output').style.height = `${height}px`;
  };

  svgPrefixId = function(svg, prefix = 'N') {
    return svg.replace(/\b(id\s*=\s*")([^"]*")/gi, `$1${prefix}$2`).replace(/\b(xlink:href\s*=\s*"#)([^"]*")/gi, `$1${prefix}$2`);
  };

  svgExplicit = function(svg) {
    var explicit;
    explicit = SVG().addTo('#output');
    try {
      explicit.svg(svgPrefixId(svg.svg()));
      //# Expand CSS for <rect>, <line>, <polygon>
      explicit.find('rect, line, polygon').each(function() {
        var style;
        style = window.getComputedStyle(this.node);
        this.css('fill', style.fill);
        this.css('stroke', style.stroke);
        this.css('stroke-width', style.strokeWidth);
        this.css('stroke-linecap', style.strokeLinecap);
        if (style.visibility === 'hidden') {
          return this.remove();
        }
      });
      //# Remove surrounding <svg>...</svg> from explicit SVG container
      return explicit.svg().replace(/^<svg[^<>]*>/, '').replace(/<\/svg>$/, '');
    } finally {
      explicit.remove();
    }
  };

  normalStatus = 'Download Animated GIF';

  statusGIF = function(enable, text) {
    var gifButton;
    gifButton = document.getElementById('downloadGIF');
    if (gifButton == null) {
      return;
    }
    if ((text != null) || gifButton.innerText === normalStatus) {
      gifButton.disabled = !enable;
      if (text != null) {
        return gifButton.innerText = text;
      }
    }
  };

  if (typeof window !== "undefined" && window !== null) {
    window.onload = function() {
      var height, piece, pieceName, ref, ref1, ref2, ref3, rot47, width, x, y;
      svg = SVG().addTo('#output').width('100%').height('100%');
      (furls = new Furls()).addInputs('#data input, #data textarea').configInput('text', {
        encode: rot47 = function(s) {
          if (!furls.get('rot')) {
            return s;
          }
          return s.split('').map((c) => {
            var code;
            code = c.charCodeAt(0);
            if (!((33 <= code && code <= 126))) {
              return c;
            }
            return String.fromCharCode(33 + (code + 14) % 94);
          }).join('');
        },
        decode: rot47
      }).on('stateChange', updateText).syncClass();
      window.addEventListener('resize', resize);
      resize();
      if ((ref = document.getElementById('nohud')) != null) {
        ref.addEventListener('click', function() {
          return furls.set('hud', false);
        });
      }
      if ((ref1 = document.getElementById('downloadSVG')) != null) {
        ref1.addEventListener('click', function() {
          var download, explicit;
          explicit = svgExplicit(svg);
          download = document.getElementById('download');
          download.href = URL.createObjectURL(new Blob([explicit], {
            type: "image/svg+xml"
          }));
          download.download = 'tetris.svg';
          return download.click();
        });
      }
      if ((ref2 = document.getElementById('downloadGIF')) != null) {
        ref2.addEventListener('click', async function() {
          var height, viewbox, width;
          width = parseInt(document.getElementById('width').value);
          if (isNaN(width) || width <= 0) {
            width = 1024;
          }
          viewbox = svg.viewbox();
          height = Math.floor(width * viewbox.height / viewbox.width);
          await import('./node_modules/gif.js/dist/gif.js');
          recording = new GIF({
            workerScript: './node_modules/gif.js/dist/gif.worker.js',
            width: width,
            height: height
          });
          statusGIF(false, 'Rendering Animated GIF...');
          return updateText.call(furls, {
            recording: true
          });
        });
      }
      ref3 = window.pieces;
      for (pieceName in ref3) {
        piece = ref3[pieceName];
        if (!document.getElementById(`piece${pieceName}`)) {
          return;
        }
        width = Math.max(...((function() {
          var j, len, ref4, results;
          ref4 = piece.polygon;
          results = [];
          for (j = 0, len = ref4.length; j < len; j++) {
            [x, y] = ref4[j];
            results.push(x);
          }
          return results;
        })()));
        height = Math.max(...((function() {
          var j, len, ref4, results;
          ref4 = piece.polygon;
          results = [];
          for (j = 0, len = ref4.length; j < len; j++) {
            [x, y] = ref4[j];
            results.push(y);
          }
          return results;
        })()));
        x = SVG().addTo(`#piece${pieceName}`).viewbox(-0.1, -0.1, width + 0.2, height + 0.2).width(width * 8).height(height * 8).polygon(piece.polygon).addClass(pieceName);
      }
    };
  }

}).call(this);
