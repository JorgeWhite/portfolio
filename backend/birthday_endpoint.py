import os
import json
from pathlib import Path
import unicodedata

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response

router = APIRouter()

RUNTIME_DIR = Path(__file__).with_name("birthday_runtime").resolve()
RUNTIME_INDEX = RUNTIME_DIR / "index.html"
MESSAGE_FILE = RUNTIME_DIR / os.getenv("BIRTHDAY_MESSAGE_FILE", "happy_birthday.txt")

DEFAULT_MESSAGE = os.getenv("BIRTHDAY_MESSAGE", "FELIZ CUMPLEANOS JORGEEEE")


def _coerce_speed(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError:
        parsed = 0
    return max(0, min(20, parsed))


DEFAULT_SPEED = _coerce_speed(os.getenv("BIRTHDAY_SPEED", "20"))


def _ensure_runtime_is_ready() -> None:
    if not RUNTIME_INDEX.is_file():
        raise HTTPException(
            status_code=503,
            detail="Birthday runtime assets are not available.",
        )


def _normalize_message_for_font(message: str) -> str:
    normalized = unicodedata.normalize("NFKD", message)
    without_accents = "".join(
        char for char in normalized if not unicodedata.combining(char)
    )
    uppercase = without_accents.upper()

    allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ?,.\n")
    sanitized = "".join(char if char in allowed else " " for char in uppercase)
    return sanitized


def _load_message() -> str:
    try:
        from_txt = MESSAGE_FILE.read_text(encoding="utf-8-sig").strip()
        if from_txt:
            normalized = _normalize_message_for_font(from_txt)
            if normalized.strip():
                return normalized
    except OSError:
        pass

    return _normalize_message_for_font(DEFAULT_MESSAGE)


def _runtime_url() -> str:
    return "/_birthday_tetris/index.html"


def _render_runtime_index(message: str, speed: int) -> str:
    base_html = RUNTIME_INDEX.read_text(encoding="utf-8")
    message_json = json.dumps(message)

    if "<head>" in base_html:
        base_html = base_html.replace("<head>", "<head><base href=\"/_birthday_tetris/\">", 1)

    script_template = r"""
<script>
(function() {
    document.documentElement.classList.add('hud-false');
    window.__BIRTHDAY_MESSAGE__ = __MSG__;
    window.__BIRTHDAY_SPEED__ = __SPEED__;
    window.__BIRTHDAY_SINGLE_PASS__ = true;

    if (window.font) {
        if (!window.font['.']) {
            window.font['.'] = {
                order: ['O'],
                partial: { O: '' },
                height: 8,
                width: 2,
                O: { r: 0, tx: 0, ty: 6 }
            };
        }
        if (!window.font[',']) {
            window.font[','] = {
                order: ['L'],
                partial: { L: '' },
                height: 8,
                width: 3,
                L: { r: 0, tx: 0, ty: 6 }
            };
        }
    }

    var resizeTimer = null;

    function emit(el, type) {
        el.dispatchEvent(new Event(type, { bubbles: true }));
    }

    function getWrapColumns() {
        var w = window.innerWidth || 1280;
        return w < 420 ? 10 : w < 640 ? 14 : w < 900 ? 18 : w < 1200 ? 24 : 30;
    }

    function wrapParagraph(paragraph, maxChars) {
        var words = paragraph.split(/\s+/).filter(Boolean);
        if (!words.length) {
            return [];
        }

        var hardSplitThreshold = Math.max(maxChars * 2, maxChars + 12);
        var lines = [];
        var current = '';
        for (var i = 0; i < words.length; i += 1) {
            if (words[i].length > maxChars) {
                if (current) {
                    lines.push(current);
                    current = '';
                }
                if (words[i].length > hardSplitThreshold) {
                    for (var cut = 0; cut < words[i].length; cut += maxChars) {
                        lines.push(words[i].slice(cut, cut + maxChars));
                    }
                } else {
                    // Keep common long words intact; push them to their own line.
                    lines.push(words[i]);
                }
                continue;
            }

            var candidate = current ? (current + ' ' + words[i]) : words[i];
            if (candidate.length <= maxChars || !current) {
                current = candidate;
            } else {
                lines.push(current);
                current = words[i];
            }
        }
        if (current) {
            lines.push(current);
        }
        return lines;
    }

    function buildWrappedMessage(rawMessage) {
        var columns = getWrapColumns();
        var paragraphs = String(rawMessage || '')
            .split(/\n+/)
            .map(function(part) { return part.trim(); })
            .filter(Boolean);

        var lines = [];
        for (var i = 0; i < paragraphs.length; i += 1) {
            var wrapped = wrapParagraph(paragraphs[i], columns);
            lines = lines.concat(wrapped);
            if (i < paragraphs.length - 1) {
                lines.push('');
            }
        }

        if (!lines.length) {
            lines = ['FELIZ CUMPLEANOS'];
        }
        return lines.join('\n');
    }

    function applyControls() {
        var anim = document.getElementById('anim');
        if (anim && !anim.checked) {
            anim.checked = true;
            emit(anim, 'change');
        }

        var seq = document.getElementById('seq');
        if (seq && !seq.checked) {
            seq.checked = true;
            emit(seq, 'change');
        }

        var hud = document.getElementById('hud');
        if (hud && hud.checked) {
            hud.checked = false;
            emit(hud, 'change');
        }

        var floor = document.getElementById('floor');
        if (floor && floor.checked) {
            floor.checked = false;
            emit(floor, 'change');
        }

        var speedInput = document.getElementById('speed');
        if (speedInput) {
            speedInput.value = String(window.__BIRTHDAY_SPEED__ || 0);
            emit(speedInput, 'input');
            emit(speedInput, 'change');
        }
    }

    function ensureParchmentShell() {
        var output = document.getElementById('output');
        if (!output || !output.parentNode) {
            return null;
        }

        var shell = document.getElementById('birthday-shell');
        if (!shell) {
            shell = document.createElement('div');
            shell.id = 'birthday-shell';
            output.parentNode.insertBefore(shell, output);
            shell.appendChild(output);
        }

        return shell;
    }

    function fitScrollableCanvas() {
        var output = document.getElementById('output');
        if (!output) {
            return;
        }

        var shell = ensureParchmentShell();
        if (!shell) {
            return;
        }

        var viewportWidth = window.innerWidth || 1280;
        var frameWidth = Math.max(320, Math.min(viewportWidth - 20, 1300));

        shell.style.width = frameWidth + 'px';
        shell.style.height = '92vh';
        shell.style.maxHeight = '92vh';
        shell.style.margin = '4vh auto';
        shell.style.boxSizing = 'border-box';

        output.style.overflowX = 'hidden';
        output.style.overflowY = 'auto';
        output.style.width = '100%';
        output.style.height = '100%';
        output.style.maxHeight = '100%';
        output.style.margin = '0';
        output.style.padding = '28px 24px';
        output.style.boxSizing = 'border-box';

        var svgNode = output.querySelector('svg');
        if (!svgNode || !svgNode.viewBox || !svgNode.viewBox.baseVal) {
            return;
        }

        var vb = svgNode.viewBox.baseVal;
        if (!vb || !vb.width || !vb.height) {
            return;
        }

        var targetWidth = Math.max(260, output.clientWidth - 48);
        var targetHeight = Math.max(320, Math.round(targetWidth * vb.height / vb.width));

        svgNode.setAttribute('width', String(targetWidth));
        svgNode.setAttribute('height', String(targetHeight));
        svgNode.style.width = targetWidth + 'px';
        svgNode.style.height = targetHeight + 'px';
        svgNode.style.display = 'block';
        svgNode.style.margin = '0 auto';
    }

    function enforceVisualTweaks() {
        var styleId = 'birthday-runtime-overrides';
        if (document.getElementById(styleId)) {
            return;
        }

        var css = '' +
            '.base{display:none!important;}' +
            '.hud-false > body > #birthday-shell{display:block!important;}' +
            'html,body{min-height:100%;}' +
            'body{margin:0;background:' +
                'radial-gradient(circle at 15% 20%,rgba(247,221,171,.26),transparent 36%),' +
                'radial-gradient(circle at 80% 12%,rgba(255,245,214,.22),transparent 30%),' +
                'linear-gradient(145deg,#5f422b 0%,#7a5334 38%,#8a6645 100%);' +
                'display:flex;align-items:center;justify-content:center;' +
                'font-family:"Palatino Linotype","Book Antiqua",Garamond,serif;}' +
            '#birthday-shell{' +
                'position:relative;overflow:hidden;' +
                'background:' +
                    'radial-gradient(circle at 12% 16%,rgba(255,248,220,.45),transparent 24%),' +
                    'repeating-linear-gradient(0deg,rgba(122,79,37,.05) 0 2px,rgba(255,255,255,0) 2px 5px),' +
                    'linear-gradient(172deg,#efd9b1 0%,#e8ca94 47%,#ddb880 100%);' +
                'border-style:solid;border-width:3px 10px 12px 6px;' +
                'border-color:#8f6538 #6f4628 #5f3b22 #8a623a;' +
                'border-radius:0;' +
                'clip-path:polygon(0% 7%,4% 1%,11% 6%,18% 0%,26% 5%,34% 1%,43% 6%,52% 0%,61% 5%,70% 1%,79% 6%,88% 0%,96% 5%,100% 10%,97% 18%,100% 28%,96% 38%,100% 48%,97% 59%,100% 70%,96% 81%,100% 91%,95% 100%,86% 96%,76% 100%,66% 95%,56% 100%,46% 96%,36% 100%,26% 95%,16% 100%,8% 96%,0% 90%,3% 79%,0% 67%,4% 56%,0% 45%,3% 34%,0% 23%,4% 13%);' +
                'box-shadow:' +
                    '0 14px 28px rgba(30,14,3,.34),' +
                    'inset 0 0 0 1px rgba(255,241,208,.60),' +
                    'inset 0 0 20px rgba(124,72,29,.18),' +
                    'inset 0 1px 0 rgba(255,244,214,.45),' +
                    'inset -1px 0 0 rgba(120,74,36,.22),' +
                    'inset 0 -2px 0 rgba(112,66,31,.24);}' +
            '#birthday-shell::before{content:none;}' +
            '#output{' +
                'position:relative;z-index:1;overflow-x:hidden!important;overflow-y:auto!important;' +
                'scrollbar-width:none;-ms-overflow-style:none;' +
                'width:100%;height:100%;max-height:100%;margin:0;padding:28px 24px;box-sizing:border-box;' +
                'background:transparent;border:0;border-radius:0;box-shadow:none;}' +
            '#output::-webkit-scrollbar{width:0;height:0;display:none;}' +
            '#output::after{content:none;}' +
            '#output svg{position:relative;z-index:1;filter:drop-shadow(.8px 1px 0 rgba(73,40,19,.32));}' +
            '@media (max-width:760px){#birthday-shell{border-width:3px 7px 9px 5px;clip-path:polygon(0% 8%,5% 2%,12% 8%,21% 1%,30% 7%,40% 2%,50% 8%,60% 1%,70% 7%,80% 2%,90% 8%,100% 12%,96% 21%,100% 33%,95% 45%,100% 58%,96% 71%,100% 84%,94% 100%,82% 95%,68% 100%,54% 95%,40% 100%,26% 95%,12% 100%,0% 90%,4% 76%,0% 62%,5% 49%,0% 36%,4% 23%,0% 12%);}#output{padding:18px 14px;}}';

        var style = document.createElement('style');
        style.id = styleId;
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }

    function renderSinglePass() {
        var text = document.getElementById('text');
        if (!text) {
            return;
        }

        text.value = buildWrappedMessage(window.__BIRTHDAY_MESSAGE__);
        emit(text, 'input');
        emit(text, 'change');

        window.requestAnimationFrame(function() {
            window.requestAnimationFrame(fitScrollableCanvas);
        });
    }

    window.addEventListener('load', function() {
        enforceVisualTweaks();
        applyControls();
        renderSinglePass();
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname);
        }
    });

    window.addEventListener('resize', function() {
        if (resizeTimer) {
            window.clearTimeout(resizeTimer);
        }
        resizeTimer = window.setTimeout(fitScrollableCanvas, 220);
    });
})();
</script>
"""

    inject_script = (
        script_template.replace("__MSG__", message_json).replace("__SPEED__", str(speed))
    )

    if "</head>" in base_html:
        return base_html.replace("</head>", inject_script + "</head>", 1)
    return inject_script + base_html


def _safe_asset_path(file_path: str) -> Path:
    requested = (RUNTIME_DIR / file_path).resolve()
    if RUNTIME_DIR not in requested.parents and requested != RUNTIME_DIR:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not requested.is_file():
        raise HTTPException(status_code=404, detail="Asset not found")
    return requested


@router.get("/_birthday_tetris")
@router.get("/_birthday_tetris/")
def birthday_runtime_entry() -> RedirectResponse:
    _ensure_runtime_is_ready()
    return RedirectResponse(url=_runtime_url(), status_code=307)


@router.get("/_birthday_tetris/index.html", response_class=HTMLResponse)
def birthday_runtime_index() -> HTMLResponse:
    _ensure_runtime_is_ready()
    message = _load_message()
    content = _render_runtime_index(message, DEFAULT_SPEED)
    return HTMLResponse(content=content)


@router.get("/_birthday_tetris/{file_path:path}")
def birthday_runtime_assets(file_path: str) -> FileResponse:
    _ensure_runtime_is_ready()
    asset_path = _safe_asset_path(file_path)
    return FileResponse(asset_path)


@router.get("/felizcumpleanoskarlita", response_class=HTMLResponse)
@router.get("/felizcumpleanos/", response_class=HTMLResponse)
@router.get("/felizcumpleaños", response_class=HTMLResponse)
@router.get("/felizcumpleaños/", response_class=HTMLResponse)
def birthday_secret_page() -> Response:
    try:
        _ensure_runtime_is_ready()
    except HTTPException:
        return HTMLResponse(
            "<h1>Birthday runtime is not available.</h1>",
            status_code=503,
        )

    message = _load_message()
    content = _render_runtime_index(message, DEFAULT_SPEED)
    return HTMLResponse(content=content)
