



function GameManager(size, InputManager, Actuator) {
    this.size = size;
    this.input = new InputManager();
    this.storage = new LocalStorageManager();
    this.actuator = new Actuator();
    this.startTiles = 2;
    this.score = 0;
    this.bestScore = this.storage.getBestScore();

    this.input.on("move", this.move.bind(this));
    this.input.on("restart", this.restart.bind(this));
    this.input.on("undo", this.undo.bind(this));
    this.input.on("exchangeToggle", this.exchangeToggle.bind(this));
    this.input.on("removeToggle", this.removeToggle.bind(this));
    this.input.on("tileClick", this.handleTileClick.bind(this));

    this.setup();
}



GameManager.prototype.setup = function () {
    this.grid = new Grid(this.size);
    this.over = false;
    this.won = false;
    this.keepPlaying = false;
    this.score = 0;
    this.bestScore = this.storage.getBestScore();
    this.undoStack = [];   
    this.undosUsed = 0;    
    this._undoFired = false;
    this.exchangesUsed = 0;  
    this._exchangeMode = false;
    this._exchangeFirst = null;
    this._exchangeSecond = null;   
    this._exchangePending = false; 
    this._exchangeFired = false;
    this.removesUsed = 0;      
    this._removeMode = false;
    this._removePending = false; 
    this._removeTarget = null;   
    this._removeFired = false;

    this.addStartTiles();
    this.actuate();
};

GameManager.prototype.restart = function () {
    this.actuator.hideMessage();
    if (typeof SoundManager !== "undefined") SoundManager.resetTerminal();
    this.setup();
};

GameManager.prototype.keepGoingAfterWin = function () {
    this.keepPlaying = true;
    this.actuator.hideMessage();
};



GameManager.prototype.addStartTiles = function () {
    for (var i = 0; i < this.startTiles; i++) {
        this.spawnTile();
    }
};


GameManager.prototype.spawnTile = function () {
    if (!this.grid.cellsAvailable()) return;
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), value);
    tile.justSpawned = true; 
    this.grid.insertTile(tile);
    if (typeof SoundManager !== "undefined") SoundManager.play("spawn");
};




GameManager.prototype.move = function (direction) {
    if (this.isTerminated()) return;
    if (this._removePending) return; 

    var self = this;
    var stateBeforeMove = this._snapshotState();
    var vector = this.getVector(direction);
    var trav = this.buildTraversals(vector);
    var moved = false;

    this.prepareGrid();

    trav.x.forEach(function (x) {
        trav.y.forEach(function (y) {
            var cell = { x: x, y: y };
            var tile = self.grid.cellContent(cell);
            if (!tile) return;

            var positions = self.findFarthest(cell, vector);
            var next = self.grid.cellContent(positions.next);

            
            if (next && next.value === tile.value && !next.mergedFrom) {
                var merged = new Tile(positions.next, tile.value * 2);
                merged.mergedFrom = [tile, next];
                self.grid.insertTile(merged);
                self.grid.removeTile(tile);
                tile.updatePosition(positions.next);

                self.score += merged.value;
                if (self.score > self.bestScore) {
                    self.bestScore = self.score;
                    self.storage.setBestScore(self.bestScore);
                }

                if (typeof SoundManager !== "undefined") SoundManager.play("merge");

                if (merged.value === 2048) {
                    self.won = true;
                    if (typeof SoundManager !== "undefined") SoundManager.play("win");
                }
            } else {
                self.moveTile(tile, positions.farthest);
            }

            if (!self.posEqual(cell, tile)) moved = true;
        });
    });

    if (moved) {
        
        if (this._exchangeMode) {
            this._exchangeMode = false;
            this._exchangeFirst = null;
        }
        
        if (this._removeMode) {
            this._removeMode = false;
        }
        
        if (this.undosUsed < 2) {
            this.undoStack.push(stateBeforeMove);
            if (this.undoStack.length > 2) this.undoStack.shift();
        }
        if (typeof SoundManager !== "undefined") SoundManager.play("move");
        this.spawnTile();
        if (!this.movesAvailable()) {
            this.over = true;
            if (typeof SoundManager !== "undefined") SoundManager.play("gameover");
        }
        this.actuate();
    }
};





GameManager.prototype._clearMergeState = function () {
    this.grid.eachCell(function (x, y, tile) {
        if (tile) {
            tile.mergedFrom = null;
            tile.previousPosition = null;
            tile.justSpawned = false;
        }
    });
};

GameManager.prototype.exchangeToggle = function () {
    if (this.isTerminated()) return;
    if (this.exchangesUsed >= 2) return;
    if (this._exchangePending) return; 
    if (this._removePending) return;   
    
    if (this._removeMode) { this._removeMode = false; }
    this._clearMergeState();
    this._exchangeMode = !this._exchangeMode;
    if (!this._exchangeMode && typeof SoundManager !== "undefined") SoundManager.stopPowerUp();
    this._exchangeFirst = null;
    this._exchangeSecond = null;
    this.actuate();
};



GameManager.prototype.removeToggle = function () {
    if (this.isTerminated()) return;
    if (this.removesUsed >= 2) return;
    if (this._removePending) return;   
    if (this._exchangePending) return; 
    
    var tileCount = (this.grid.size * this.grid.size) - this.grid.availableCells().length;
    if (tileCount <= 2) return;
    
    if (this._exchangeMode) {
        this._exchangeMode = false;
        this._exchangeFirst = null;
        this._exchangeSecond = null;
        if (typeof SoundManager !== "undefined") SoundManager.stopPowerUp();
    }
    this._clearMergeState();
    this._removeMode = !this._removeMode;
    this.actuate();
};

GameManager.prototype.handleTileClick = function (pos) {
    
    if (this._removeMode && !this._exchangeMode) {
        if (this.isTerminated()) return;
        if (this._removePending) return; 
        var rtile = this.grid.cellContent(pos);
        if (!rtile) return; 

        this._removePending = true;
        this._removeTarget = { x: pos.x, y: pos.y };
        this._clearMergeState();
        if (typeof SoundManager !== "undefined") SoundManager.play("blackHole");
        this.actuate(); 

        var self = this;
        setTimeout(function () {
            var t = self.grid.cells[self._removeTarget.x][self._removeTarget.y];
            if (t) self.grid.removeTile(t);
            self.grid.cells[self._removeTarget.x][self._removeTarget.y] = null;
            self._removeTarget = null;
            self._removePending = false;
            self._removeMode = false;
            self.removesUsed++;
            self._removeFired = true;
            self.actuate();
        }, 600);
        return;
    }

    
    if (!this._exchangeMode || this.isTerminated()) return;
    if (this._exchangePending) return; 
    var tile = this.grid.cellContent(pos);
    if (!tile) return; 

    if (!this._exchangeFirst) {
        
        this._clearMergeState(); 
        this._exchangeFirst = { x: pos.x, y: pos.y };
        if (typeof SoundManager !== "undefined") SoundManager.play("swapSelect");
        this.actuate();
    } else {
        
        if (this._exchangeFirst.x === pos.x && this._exchangeFirst.y === pos.y) {
            this._exchangeFirst = null;
            if (typeof SoundManager !== "undefined") SoundManager.stopPowerUp();
            this.actuate();
            return;
        }
        
        this._exchangeSecond = { x: pos.x, y: pos.y };
        this._exchangePending = true;
        this._clearMergeState();
        if (typeof SoundManager !== "undefined") SoundManager.play("swapConfirm");
        this.actuate(); 

        var self = this;
        setTimeout(function () {
            self._doExchange(self._exchangeFirst, self._exchangeSecond);
            self._exchangeFirst = null;
            self._exchangeSecond = null;
            self._exchangePending = false;
            self._exchangeMode = false;
            self.exchangesUsed++;
            self._exchangeFired = true;
            self.actuate(); 
        }, 620);
    }
};

GameManager.prototype._doExchange = function (pos1, pos2) {
    if (typeof SoundManager !== "undefined") SoundManager.play("swap");
    var tile1 = this.grid.cells[pos1.x][pos1.y];
    var tile2 = this.grid.cells[pos2.x][pos2.y];
    
    
    if (tile1) { tile1.mergedFrom = null; tile1.justSpawned = false; }
    if (tile2) { tile2.mergedFrom = null; tile2.justSpawned = false; }
    if (tile1) { tile1.savePosition(); tile1.updatePosition(pos2); }
    if (tile2) { tile2.savePosition(); tile2.updatePosition(pos1); }
    this.grid.cells[pos2.x][pos2.y] = tile1 || null;
    this.grid.cells[pos1.x][pos1.y] = tile2 || null;
};



GameManager.prototype._snapshotState = function () {
    var cells = [];
    for (var x = 0; x < this.size; x++) {
        cells[x] = [];
        for (var y = 0; y < this.size; y++) {
            var tile = this.grid.cells[x][y];
            cells[x][y] = tile ? { value: tile.value } : null;
        }
    }
    return { cells: cells, score: this.score, over: this.over, won: this.won };
};

GameManager.prototype.undo = function () {
    if (this.isTerminated()) return;   
    if (this.undoStack.length === 0 || this.undosUsed >= 2) return;

    var snap = this.undoStack.pop();
    this.undosUsed++;

    
    
    var currentPool = [];
    for (var cx = 0; cx < this.size; cx++) {
        for (var cy = 0; cy < this.size; cy++) {
            if (this.grid.cells[cx][cy]) {
                currentPool.push({
                    x: cx, y: cy,
                    value: this.grid.cells[cx][cy].value,
                    used: false
                });
            }
        }
    }

    
    this.grid = new Grid(this.size);
    for (var rx = 0; rx < this.size; rx++) {
        for (var ry = 0; ry < this.size; ry++) {
            if (!snap.cells[rx][ry]) continue;
            var restoredTile = new Tile({ x: rx, y: ry }, snap.cells[rx][ry].value);

            
            var bestIdx = -1;
            var bestDist = Infinity;
            for (var pi = 0; pi < currentPool.length; pi++) {
                if (currentPool[pi].used) continue;
                if (currentPool[pi].value !== snap.cells[rx][ry].value) continue;
                var d = Math.abs(currentPool[pi].x - rx) + Math.abs(currentPool[pi].y - ry);
                if (d < bestDist) { bestDist = d; bestIdx = pi; }
            }
            
            if (bestIdx >= 0 && bestDist > 0) {
                restoredTile.previousPosition = {
                    x: currentPool[bestIdx].x,
                    y: currentPool[bestIdx].y
                };
                currentPool[bestIdx].used = true;
            }

            this.grid.cells[rx][ry] = restoredTile;
        }
    }

    this.score = snap.score;
    this.over = snap.over;
    this.won = snap.won;

    this._undoFired = true;
    if (typeof SoundManager !== "undefined") SoundManager.play("undo");
    this.actuate();
};




GameManager.prototype.prepareGrid = function () {
    this.grid.eachCell(function (x, y, tile) {
        if (tile) {
            tile.mergedFrom = null;
            tile.savePosition();
        }
    });
};

GameManager.prototype.moveTile = function (tile, cell) {
    this.grid.cells[tile.x][tile.y] = null;
    this.grid.cells[cell.x][cell.y] = tile;
    tile.updatePosition(cell);
};


GameManager.prototype.getVector = function (dir) {
    var map = {
        0: { x: 0, y: -1 }, 
        1: { x: 1, y: 0 }, 
        2: { x: 0, y: 1 }, 
        3: { x: -1, y: 0 }  
    };
    return map[dir];
};


GameManager.prototype.buildTraversals = function (vec) {
    var t = { x: [], y: [] };
    for (var i = 0; i < this.size; i++) {
        t.x.push(i);
        t.y.push(i);
    }
    if (vec.x === 1) t.x.reverse();
    if (vec.y === 1) t.y.reverse();
    return t;
};


GameManager.prototype.findFarthest = function (cell, vec) {
    var prev;
    do {
        prev = cell;
        cell = { x: prev.x + vec.x, y: prev.y + vec.y };
    } while (this.grid.withinBounds(cell) && this.grid.cellAvailable(cell));

    return { farthest: prev, next: cell };
};

GameManager.prototype.movesAvailable = function () {
    return this.grid.cellsAvailable() || this.matchesAvailable();
};

GameManager.prototype.matchesAvailable = function () {
    var self = this;
    for (var x = 0; x < this.size; x++) {
        for (var y = 0; y < this.size; y++) {
            var tile = this.grid.cellContent({ x: x, y: y });
            if (!tile) continue;
            for (var d = 0; d < 4; d++) {
                var vec = self.getVector(d);
                var other = self.grid.cellContent({ x: x + vec.x, y: y + vec.y });
                if (other && other.value === tile.value) return true;
            }
        }
    }
    return false;
};

GameManager.prototype.posEqual = function (a, b) {
    return a.x === b.x && a.y === b.y;
};

GameManager.prototype.isTerminated = function () {
    return this.over || (this.won && !this.keepPlaying);
};



GameManager.prototype.actuate = function () {
    var isUndo = !!this._undoFired;
    this._undoFired = false;
    var isExchange = !!this._exchangeFired;
    this._exchangeFired = false;
    var isRemove = !!this._removeFired;
    this._removeFired = false;
    this.actuator.render(this.grid, {
        over: this.over,
        won: this.won,
        terminated: this.isTerminated(),
        score: this.score,
        bestScore: this.bestScore,
        undosLeft: Math.max(0, 2 - this.undosUsed),
        canUndo: this.undoStack.length > 0 && this.undosUsed < 2 && !this.isTerminated(),
        isUndo: isUndo,
        exchangesLeft: Math.max(0, 2 - this.exchangesUsed),
        canExchange: this.exchangesUsed < 2 && !this.isTerminated(),
        exchangeMode: this._exchangeMode,
        exchangeFirst: this._exchangeFirst,
        exchangeSecond: this._exchangeSecond,
        exchangePending: this._exchangePending,
        isExchange: isExchange,
        removesLeft: Math.max(0, 2 - this.removesUsed),
        canRemove: this.removesUsed < 2 && !this.isTerminated() &&
            ((this.grid.size * this.grid.size) - this.grid.availableCells().length) > 2,
        removeMode: this._removeMode,
        removePending: this._removePending,
        removeTarget: this._removeTarget,
        isRemove: isRemove
    });
};

