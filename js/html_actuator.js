



function HTMLActuator() {
    this.shell = document.querySelector(".board-shell");
    this.tiles = document.querySelector(".tile-container");
    this.message = document.querySelector(".game-message");
    this.msgText = document.querySelector(".game-message-text");
    this.scoreEl = document.querySelector(".score-value");
    this.bestEl = document.querySelector(".best-value");
    this.undoBtn = document.querySelector(".undo-button");
    this.undoCount = document.querySelector(".undo-count");
    this.exchangeBtn = document.querySelector(".exchange-button");
    this.exchangeCount = document.querySelector(".exchange-count");
    this.removeBtn = document.querySelector(".remove-button");
    this.removeCount = document.querySelector(".remove-count");
    this.swapHint = document.querySelector(".swap-hint");
    this._s = null;
    this._isUndo = false;
    this._isExchange = false;
    this._isRemove = false;
    this._exchangeMode = false;
    this._exchangeFirst = null;
    this._exchangeSecond = null;
    this._exchangePending = false;
    this._removeMode = false;
    this._removePending = false;
    this._removeTarget = null;



    var self = this;
    var resizeTimer;
    function onResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            self._s = null;

            self._measure();
            if (!self._s) return;
            var tiles = self.tiles ? self.tiles.querySelectorAll(".tile") : [];
            for (var i = 0; i < tiles.length; i++) {
                var gx = parseInt(tiles[i].getAttribute("data-gx"), 10);
                var gy = parseInt(tiles[i].getAttribute("data-gy"), 10);
                if (!isNaN(gx) && !isNaN(gy)) {
                    var pos = self._pos(gx, gy);
                    tiles[i].style.left = pos.left + "px";
                    tiles[i].style.top = pos.top + "px";
                    tiles[i].style.width = self._s.cell + "px";
                    tiles[i].style.height = self._s.cell + "px";
                }
            }
        }, 120);
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", function () {

        setTimeout(onResize, 300);
    });
}




HTMLActuator.prototype._measure = function () {
    var firstCell = document.querySelector(".grid-cell");
    if (!firstCell) return;


    var containerRect = this.tiles.getBoundingClientRect();
    var cellRect = firstCell.getBoundingClientRect();
    var gapPx = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--gap")
    ) || 12;
    this._s = {
        ox: cellRect.left - containerRect.left,
        oy: cellRect.top - containerRect.top,
        cell: cellRect.width,
        step: cellRect.width + gapPx
    };
};


HTMLActuator.prototype._pos = function (col, row) {
    var s = this._s;
    return { left: s.ox + col * s.step, top: s.oy + row * s.step };
};



HTMLActuator.prototype.render = function (grid, meta) {
    var self = this;
    this._isUndo = !!meta.isUndo;
    this._isExchange = !!meta.isExchange;
    this._isRemove = !!meta.isRemove;
    this._exchangeMode = !!meta.exchangeMode;
    this._exchangeFirst = meta.exchangeFirst || null;
    this._exchangeSecond = meta.exchangeSecond || null;
    this._exchangePending = !!meta.exchangePending;
    this._removeMode = !!meta.removeMode;
    this._removePending = !!meta.removePending;
    this._removeTarget = meta.removeTarget || null;
    this._measure();
    this._clear();
    grid.cells.forEach(function (col) {
        col.forEach(function (tile) {
            if (tile) self._drawTile(tile);
        });
    });
    if (this.scoreEl) this.scoreEl.textContent = meta.score;
    if (this.bestEl) this.bestEl.textContent = meta.bestScore;

    if (this.undoCount) this.undoCount.textContent = meta.undosLeft;
    if (this.undoBtn) {
        this.undoBtn.disabled = !meta.canUndo;
        this.undoBtn.classList.toggle("undo-exhausted", meta.undosLeft <= 0);
    }

    if (this.exchangeCount) this.exchangeCount.textContent = meta.exchangesLeft;
    if (this.exchangeBtn) {
        this.exchangeBtn.disabled = !meta.canExchange;
        this.exchangeBtn.classList.toggle("exchange-active", this._exchangeMode);
        this.exchangeBtn.classList.toggle("exchange-exhausted", meta.exchangesLeft <= 0);
    }

    if (this.removeCount) this.removeCount.textContent = meta.removesLeft;
    if (this.removeBtn) {
        this.removeBtn.disabled = !meta.canRemove;
        this.removeBtn.classList.toggle("remove-active", this._removeMode);
        this.removeBtn.classList.toggle("remove-exhausted", meta.removesLeft <= 0);
    }

    if (this.shell) {
        this.shell.classList.toggle("exchange-mode", this._exchangeMode);
        this.shell.classList.toggle("remove-mode", this._removeMode);
    }

    if (this.swapHint) {
        if (this._removeMode) {

            if (this._removePending) {
                this.swapHint.textContent = "\u2716 Consuming...";
                this.swapHint.classList.remove("step2");
                this.swapHint.classList.add("remove-step", "remove-pending");
            } else {
                this.swapHint.textContent = "\u2715 Click a tile to remove it";
                this.swapHint.classList.remove("step2", "pending", "remove-pending");
                this.swapHint.classList.add("remove-step");
            }
            this.swapHint.classList.add("visible");
        } else if (this._exchangeMode) {
            if (this._exchangePending) {
                this.swapHint.textContent = "\u2605 Swapping...";
                this.swapHint.classList.add("step2", "pending");
            } else if (this._exchangeFirst) {
                this.swapHint.textContent = "\u2726 Now click a tile to swap with it";
                this.swapHint.classList.add("step2");
                this.swapHint.classList.remove("pending");
            } else {
                this.swapHint.textContent = "\u2726 Click a tile to select it";
                this.swapHint.classList.remove("step2", "pending");
            }
            this.swapHint.classList.add("visible");
        } else {
            this.swapHint.classList.remove("visible", "step2", "pending", "remove-step", "remove-pending");
        }
    }
    if (meta.terminated) {
        if (meta.over) self._showMessage("Mission Failed", "over");
        else if (meta.won) self._showMessage("You reached 2048!", "won");
    }
};

HTMLActuator.prototype.hideMessage = function () {
    this.message.classList.remove("active", "over", "won");
};

HTMLActuator.prototype._clear = function () {
    while (this.tiles.firstChild) this.tiles.removeChild(this.tiles.firstChild);
};






HTMLActuator.prototype._fireSwapBurst = function (el) {
    var self = this;
    var STARS = 12;
    var COLORS = [
        "#ffd700", "#ffe84d", "#fff176", "#ffffff",
        "#ffb300", "#ff8f00", "#fffde7", "#80ffea",
        "#00e5ff", "#b2ebf2", "#ffd54f", "#fff9c4"
    ];


    setTimeout(function () {
        var rect = el.getBoundingClientRect();
        var cRect = self.tiles.getBoundingClientRect();

        var cx = (rect.left + rect.width / 2) - cRect.left;
        var cy = (rect.top + rect.height / 2) - cRect.top;

        for (var i = 0; i < STARS; i++) {
            var star = document.createElement("div");
            star.className = "swap-star";
            var angleDeg = (i / STARS) * 360 + (Math.random() - 0.5) * 22;
            var angleRad = angleDeg * Math.PI / 180;
            var dist = 38 + Math.random() * 28;
            var tx = Math.cos(angleRad) * dist;
            var ty = Math.sin(angleRad) * dist;
            var size = 4 + Math.random() * 5;
            var color = COLORS[i % COLORS.length];
            star.style.cssText = [
                "left:" + cx + "px",
                "top:" + cy + "px",
                "width:" + size + "px",
                "height:" + size + "px",
                "--tx:" + tx + "px",
                "--ty:" + ty + "px",
                "background:" + color,
                "animation-delay:" + (Math.random() * 40) + "ms"
            ].join(";");
            self.tiles.appendChild(star);

            setTimeout(function (s) {
                if (s.parentNode) s.parentNode.removeChild(s);
            }, 780, star);
        }
    }, 130);
};




HTMLActuator.prototype._fireBHParticles = function (el) {
    var self = this;


    var SPARKLE_COLORS = [
        "#ff2a1a", "#ff4422", "#ff6633", "#cc1100",
        "#ff8844", "#ee2200", "#ff5533", "#dd3311",
        "#ff1a0a", "#cc0000", "#aa0000", "#ff3322",
        "#ffffff", "#ffccbb", "#ffaa88", "#ff6644"
    ];
    var EMBER_COLORS = [
        "rgba(180,20,0,0.7)", "rgba(120,0,0,0.6)",
        "rgba(60,0,0,0.5)", "rgba(200,30,10,0.6)",
        "rgba(100,0,0,0.5)", "rgba(150,10,0,0.55)"
    ];

    var rect = el.getBoundingClientRect();
    var cRect = self.tiles.getBoundingClientRect();
    var cx = (rect.left + rect.width / 2) - cRect.left;
    var cy = (rect.top + rect.height / 2) - cRect.top;


    for (var i = 0; i < 16; i++) {
        (function (idx) {
            var delay = idx * 12 + Math.random() * 30;
            setTimeout(function () {
                var p = document.createElement("div");
                p.className = "remove-sparkle";
                var angle = (idx / 16) * 360 + (Math.random() - 0.5) * 30;
                var dist = 25 + Math.random() * 40;
                var size = 2 + Math.random() * 3;
                var dur = 300 + Math.random() * 200;
                var color = SPARKLE_COLORS[idx];

                p.style.cssText = [
                    "left:" + cx + "px",
                    "top:" + cy + "px",
                    "width:" + size + "px",
                    "height:" + size + "px",
                    "--s-tx:" + (Math.cos(angle * Math.PI / 180) * dist) + "px",
                    "--s-ty:" + (Math.sin(angle * Math.PI / 180) * dist) + "px",
                    "--s-dur:" + dur + "ms",
                    "--s-color:" + color
                ].join(";");
                self.tiles.appendChild(p);

                setTimeout(function () {
                    if (p.parentNode) p.parentNode.removeChild(p);
                }, dur + delay + 50);
            }, delay);
        }(i));
    }


    for (var e = 0; e < 6; e++) {
        (function (idx) {
            var eDelay = 40 + idx * 25;
            setTimeout(function () {
                var em = document.createElement("div");
                em.className = "remove-ember";
                var eAngle = (idx / 6) * 360 + (Math.random() - 0.5) * 40;
                var eDist = 15 + Math.random() * 20;
                var eDur = 350 + Math.random() * 150;

                em.style.cssText = [
                    "left:" + cx + "px",
                    "top:" + cy + "px",
                    "--e-tx:" + (Math.cos(eAngle * Math.PI / 180) * eDist) + "px",
                    "--e-ty:" + (Math.sin(eAngle * Math.PI / 180) * eDist) + "px",
                    "--e-dur:" + eDur + "ms",
                    "background:" + EMBER_COLORS[idx]
                ].join(";");
                self.tiles.appendChild(em);

                setTimeout(function () {
                    if (em.parentNode) em.parentNode.removeChild(em);
                }, eDur + eDelay + 50);
            }, eDelay);
        }(e));
    }


    var ring = document.createElement("div");
    ring.className = "remove-ring";
    ring.style.left = cx + "px";
    ring.style.top = cy + "px";
    self.tiles.appendChild(ring);
    setTimeout(function () {
        if (ring.parentNode) ring.parentNode.removeChild(ring);
    }, 500);
};




HTMLActuator.prototype._drawTile = function (tile, isGhost) {
    var self = this;
    var s = this._s;
    if (!s) return;



    if (!isGhost && tile.mergedFrom) {
        tile.mergedFrom.forEach(function (t) { self._drawTile(t, true); });
    }

    var el = document.createElement("div");
    var inner = document.createElement("span");

    var valClass = tile.value > 2048 ? "tile-super" : "tile-" + tile.value;
    el.className = "tile " + valClass;
    el.style.width = s.cell + "px";
    el.style.height = s.cell + "px";


    el.setAttribute("data-gx", tile.x);
    el.setAttribute("data-gy", tile.y);


    var from = tile.previousPosition || { x: tile.x, y: tile.y };
    var fromPos = this._pos(from.x, from.y);
    el.style.left = fromPos.left + "px";
    el.style.top = fromPos.top + "px";


    if (!isGhost && this._exchangeMode) {
        el.classList.add("tile-exchangeable");
        var first = this._exchangeFirst;
        var second = this._exchangeSecond;
        if (first && first.x === tile.x && first.y === tile.y) {
            el.classList.add("tile-exchange-selected");
        }
        if (second && second.x === tile.x && second.y === tile.y) {
            el.classList.add("tile-exchange-selected", "tile-exchange-second");
        }
    }


    if (!isGhost && this._removeMode) {
        el.classList.add("tile-removeable");
        if (this._removeTarget && this._removeTarget.x === tile.x && this._removeTarget.y === tile.y) {
            el.classList.add("tile-remove-target");
        }
    }

    inner.className = "tile-inner-text";
    inner.textContent = tile.value;
    el.appendChild(inner);
    this.tiles.appendChild(el);



    void el.getBoundingClientRect();

    if (isGhost) {

        el.classList.add("tile-ghost", "tile-moving");
        el.style.opacity = "0";
        var ghostTo = this._pos(tile.x, tile.y);
        el.style.left = ghostTo.left + "px";
        el.style.top = ghostTo.top + "px";

    } else if (tile.previousPosition) {

        if (this._isUndo) {
            el.classList.add("tile-moving", "tile-undo-moving");
        } else if (this._isExchange) {
            el.classList.add("tile-moving", "tile-exchange-swap");
        } else {
            el.classList.add("tile-moving");
        }
        var toPos = this._pos(tile.x, tile.y);
        el.style.left = toPos.left + "px";
        el.style.top = toPos.top + "px";

        if (this._isExchange) {
            this._fireSwapBurst(el);
        }

    } else if (tile.mergedFrom) {

        el.classList.add("tile-merged", "sfx-shimmer");



        ; (function (capturedEl, capturedValue) {
            setTimeout(function () {
                if (typeof SpaceEffects !== "undefined") {
                    if (typeof SpaceEffects.triggerCollide === "function") {
                        SpaceEffects.triggerCollide(capturedValue, capturedEl);
                    } else if (typeof SpaceEffects.trigger === "function") {
                        SpaceEffects.trigger(capturedValue, capturedEl);
                    }
                }
            }, 170);
        }(el, tile.value));

    } else {

        if (this._isUndo) {

            var undoDelay = Math.round(Math.random() * 60);
            el.style.animationDelay = undoDelay + "ms";
            el.classList.add("tile-undo-split");

            ; (function (capturedEl, delay) {
                setTimeout(function () {
                    if (typeof SpaceEffects !== "undefined") {
                        SpaceEffects.triggerTileSplit(capturedEl);
                    }
                }, delay + 40);
            }(el, undoDelay));
        } else if (tile.justSpawned) {

            el.classList.add("tile-new");
        }

        if (this._removeMode && this._removeTarget &&
            this._removeTarget.x === tile.x && this._removeTarget.y === tile.y) {
            el.classList.add("tile-bh-suck");
            this._fireBHParticles(el);
        }


    }
};



HTMLActuator.prototype._showMessage = function (text, type) {
    this.msgText.textContent = text;
    this.message.classList.add("active", type);
};

