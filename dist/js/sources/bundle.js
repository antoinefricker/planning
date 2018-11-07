var UIPlanning = function (selector, options) {

	this._domEl = $(selector);
	this._domEl.addClass('gv-planning');

	this._containerEl = this._domEl.find('.planning-container');
	this._controlsEl = this._domEl.find('.planning-controls');
	this._feedbackEl = this._domEl.find('.planning-feedback');

	this._options = Object.assign({
		hourFrom: 0,
		hourTo: 24,
		hourParts: 4,
		dayNames: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],
		stateDefault: null,
		states: []
	}, options);

	this._state = null;
	/** @var boolean   allow developper to lock rendering during extensive update processes */
	this._rangesRenderLock = true;

	this._callbacks = {
		model_setState: this.model_setState.bind(this),
		ux_releaseHover: this.ux_releaseHover.bind(this),
		ux_columnState: this.ux_columnState.bind(this),
		ux_columnHover: this.ux_columnHover.bind(this),
		ux_rowState: this.ux_rowState.bind(this),
		ux_rowHover: this.ux_rowHover.bind(this),
		ux_blockState: this.ux_blockState.bind(this),
		ux_blockStateMouseState: this.ux_blockStateMouseState.bind(this),
		model_export: this.model_export.bind(this),
		model_restore: this.model_restore.bind(this)
	};


	// ############## init

	this.dom_build();
	this._allBlocks = this._containerEl.find('.uiplanning__block');

	this.ux_interactions();

	// --- if a configuration is set ==> display it
	if (this._options.planning !== null) {
		this.model_restore();
		if (this._options.stateDefault !== null) {
			this.model_setState(this._options.stateDefault);
		}
	}

	// if a default state is set ==> fill all block with it
	else if (this._options.stateDefault !== null) {
		this.model_setState(this._options.stateDefault);
		this.dom_setBlocksState(this._allBlocks, this._state);
	}


	this._rangesRenderLock = false;
	this.dom_renderRanges();
};

UIPlanning.prototype.ux_interactions = function () {
	this._containerEl

	// --- complete day
		.on('click', '.uiplanning__day', this._callbacks.ux_rowState)
		.on('mouseenter', '.uiplanning__day', this._callbacks.ux_rowHover)
		.on('mouseleave', '.uiplanning__day', this._callbacks.ux_releaseHover)

		// ---	complete hour
		.on('click', '.uiplanning__hour', this._callbacks.ux_columnState)
		.on('mouseenter', '.uiplanning__hour', this._callbacks.ux_columnHover)
		.on('mouseleave', '.uiplanning__hour', this._callbacks.ux_releaseHover)

		// ---	hour part
		.on('click', '.uiplanning__hour-part', this._callbacks.ux_columnState)
		.on('mouseenter', '.uiplanning__hour-part', this._callbacks.ux_columnHover)
		.on('mouseleave', '.uiplanning__hour-part', this._callbacks.ux_releaseHover)

		// --- element
		.on('mousedown', '.uiplanning__block', this._callbacks.ux_blockStateMouseState)
	;

	this._controlsEl
		.on('click', '.planning-state-selector', this._callbacks.model_setState)
		.on('click', '#planning-export', this._callbacks.model_export)
		.on('click', '#planning-restore', this._callbacks.model_restore)
	;
};
UIPlanning.prototype.ux_displayError = function (message) {
	this._feedbackEl.html(message);
};

UIPlanning.prototype.ux_blockStateMouseState = function (e) {
	if (!this._state) {
		this.ux_displayError('no-state-selected');
		return;
	}

	if (e.button && e.button === 2) {
		return;
	}

	if (e.type === 'mousedown') {
		this._containerEl.on('mouseenter', '.uiplanning__block', this._callbacks.ux_blockState);
		$(document).on('mouseup', this._callbacks.ux_blockStateMouseState);
		if ($(e.target).is('.uiplanning__block')) {
			this.ux_blockState(e);
		}
	}
	else if (e.type === 'mouseup') {
		this._containerEl.off('mouseenter', '.uiplanning__block', this._callbacks.ux_blockState);
		$(document).off('mouseup', this._callbacks.ux_blockStateMouseState);
	}
};
UIPlanning.prototype.ux_blockState = function (e) {
	if (!this._state) {
		this.ux_displayError('no-state-selected');
		return;
	}

	this.dom_setBlocksState($(e.target), this._state);
};

UIPlanning.prototype.ux_releaseHover = function () {
	this._allBlocks.removeClass('uiplanning--target-hover');
};

UIPlanning.prototype.ux_rowSelect = function (e) {
	return $(e.target).closest('.uiplanning-row').find('.uiplanning__block');
};
UIPlanning.prototype.ux_rowHover = function (e) {
	this.ux_releaseHover();
	this.ux_rowSelect(e).addClass('uiplanning--target-hover');
};
UIPlanning.prototype.ux_rowState = function (e) {
	if (!this._state) {
		this.ux_displayError('no-state-selected');
		return;
	}
	this.dom_setBlocksState(this.ux_rowSelect(e), this._state);
};

UIPlanning.prototype.ux_columnSelect = function (e) {
	var el = $(e.target), index, selectors;

	// ---	complete hour
	if (el.is('.uiplanning__hour')) {
		index = el.closest('.uiplanning-row').find('.uiplanning__hour').index(el);
		selectors = [];
		for (var i = index * this._options.hourParts, iLen = i + this._options.hourParts; i < iLen; ++i) {
			selectors.push('.uiplanning__block:eq(' + i + ')');
		}
		return $('.uiplanning-row__day').find(selectors.join(', '));
	}
	// ---	hour parts
	else if (el.is('.uiplanning__hour-part')) {
		index = el.closest('.uiplanning-row').find('.uiplanning__hour-part').index(el);
		return $('.uiplanning-row__day').find('.uiplanning__block:eq(' + index + ')');

	}
};
UIPlanning.prototype.ux_columnHover = function (e) {
	this.ux_releaseHover();
	this.ux_columnSelect(e).addClass('uiplanning--target-hover');
};
UIPlanning.prototype.ux_columnState = function (e) {
	if (!this._state) {
		this.ux_displayError('no-state-selected');
		return;
	}
	this.dom_setBlocksState(this.ux_columnSelect(e), this._state);
};

UIPlanning.prototype.dom_setBlocksState = function (blocks, state) {
	if (!blocks || blocks.length === 0) {
		console.log('no-target');
		return;
	}

	blocks.attr('data-state', state ? state.uid : null);

	// render is lock --> skip render
	if (!this._rangesRenderLock) {
		this.dom_renderRanges();
	}
};
UIPlanning.prototype.dom_renderRanges = function () {
	var self = this,
		str,
		ranges, iRange, iRangeLen, range;

	// --- clear former state
	this._containerEl.find('.uiplanning__range').remove();

	ranges = this.model_retrieveRanges().ranges;
	for (iRange = 0, iRangeLen = ranges.length; iRange < iRangeLen; ++iRange) {
		range = ranges[iRange];

		// --- create tooltip instance
		str = '';
		str += '<div class="uiplanning__range">';
		str += '<div class="uiplanning__range-area"></div>';
		str += '<div class="uiplanning__range-tooltip">' + range.start + ' - ' + range.end + '</div>';
		str += '</div>';
		range.tipEl = $(str);

		range.tipEl
			.css({
				width: range.endBlock.offset().left - range.startBlock.offset().left + range.startBlock.width()
			})
			.appendTo(range.startBlock)
			.find('.uiplanning__range-area')
				.css({
					'background-color': range.state.color,
				});

		(function(range){
			for(var a = range.startIndex; a <= range.endIndex; a++){
				self._cells[range.day][a]
					.on('mouseover', function(){
						range.tipEl.addClass('show-tooltip');
					})
					.on('mouseout', function(){
						range.tipEl.removeClass('show-tooltip');
					});
			}
		}(range));
	}
};
UIPlanning.prototype.dom_build = function () {
	var str,
		self = this,
		i, iLen,
		iDay,
		classes,
		dayCells,
		iHour, iHourMod, iHourLen;


	// ##################### BUILD STATES SELECTORS

	str = '';
	for (i = 0, iLen = this._options.states.length; i < iLen; ++i) {
		str += '<div class="planning-state-selector" data-state="' + this._options.states[i].uid + '">'
			+ '<span class="bullet" style="background-color: ' + this._options.states[i].color + ';"></span>'
			+ this._options.states[i].label
			+ '</div>';
	}
	this._controlsEl.find('.controls-selectors').append(str);


	// ##################### BUILD GRID

	str = '';
	iHourLen = 24 * this._options.hourParts;

	// ---	hours display

	str += '<div class="uiplanning-row uiplanning-row__hours">';
	str += '<div></div>';
	for (iHour = 0; iHour < iHourLen; iHour++) {
		iHourMod = iHour % this._options.hourParts;
		if (iHourMod === 0)
			str += '<div class="uiplanning__hour">' + Math.ceil(iHour / this._options.hourParts) + 'h';
		else if (iHourMod === (this._options.hourParts - 1))
			str += '</div>';
	}
	str += '</div>';


	str += '<div class="uiplanning-row uiplanning-row__hour-parts">';
	str += '<div></div>';
	for (iHour = 0; iHour < iHourLen; iHour++) {
		str += '<div class="uiplanning__hour-part"></div>';
	}
	str += '</div>';


	// ---	days display
	for (iDay = 0; iDay < 7; iDay++) {
		str += '<div class="uiplanning-row uiplanning-row__day">';
		str += '<div class="uiplanning__day">' + this._options.dayNames[iDay] + '</div>';
		for (iHour = 0; iHour < iHourLen; iHour++) {
			iHourMod = iHour % this._options.hourParts;
			classes = 'uiplanning__block';
			if (iHourMod === 0) {
				classes += ' uiplanning--hour-start';
			}
			str += '<div class="' + classes + '">'
				+ '<div class="uiplanning__block-content"></div>'
				+ '</div>';
		}
		str += '</div>';
	}

	this._containerEl.append($(str));


	// --- store all cells

	this._cells = [];
	this._containerEl.find('.uiplanning-row__day').each(function (rowIndex, rowEl) {
		rowEl = $(rowEl);
		dayCells = [];
		rowEl.find('.uiplanning__block').each(function (blockIndex, blockEl) {
			dayCells.push($(blockEl));
		});
		self._cells.push(dayCells);
	});
};

UIPlanning.prototype.model_retrieveState = function (input) {
	// retrieve state from event
	if (typeof input === 'object' && input.hasOwnProperty('target')) {
		input = $(input.target).attr('data-state');
	}

	// prevent illegal calls
	if (input === null || typeof input !== 'string') {
		console.log('[UIPlanning.model_setState] Unable to retrieve state from passed-in parameter: ', input);
		return false;
	}

	for (var i = 0, iLen = this._options.states.length; i < iLen; ++i) {
		if (this._options.states[i].uid === input) {
			return this._options.states[i];
		}
	}

	console.log('[UIPlanning.model_setState] Unable to retrieve state from UID: ', input);
	return false;
};
UIPlanning.prototype.model_setState = function (state) {
	state = this.model_retrieveState(state);
	if (state === false) {
		return;
	}

	this._state = state;
	this._controlsEl.find('.planning-state-selector')
		.removeClass('active')
		.filter('[data-state="' + this._state.uid + '"]').addClass('active');
	this._domEl.trigger('stateSelected', {
		state: this._state
	});
};
UIPlanning.prototype.model_restore = function () {
	var
		p = this._options.planning,
		iDay, rowDay,
		iRange, iRangeLen, range, state,
		iCell, iCellLen;

	if (this._options.stateDefault !== null) {
		this.dom_setBlocksState(this._allBlocks, this.model_retrieveState(this._options.stateDefault));
	}

	// --- day loop
	for (iDay = 0; iDay < 7; ++iDay) {
		rowDay = this._containerEl.find('.uiplanning-row__day:eq(' + iDay + ')');

		// --- range loop
		for (iRange = 0, iRangeLen = p[iDay].length; iRange < iRangeLen; ++iRange) {
			range = p[iDay][iRange];
			state = this.model_retrieveState(range.s);

			// --- cell loop
			for (iCell = this._convertHourToIndex(range.start), iCellLen = this._convertHourToIndex(range.end); iCell < iCellLen; ++iCell) {
				this.dom_setBlocksState(rowDay.find('.uiplanning__block:eq(' + iCell + ')'), state);
			}
		}
	}
	console.log('[UIPlanning.model_restore] import completed');
};
UIPlanning.prototype.model_export = function () {
	var settings = this.model_retrieveRanges();
	console.log('model_export', JSON.stringify(settings.week));
	return settings.week;
};
UIPlanning.prototype.model_retrieveRanges = function () {
	var
		iRow, iRowLen, row,
		iRange, iRangeLen,
		iBlock, iBlockLen, block,
		out = {
			ranges: [],
			week: []
		},
		rowRanges, outRange;

	// console.time('model_retrieveRanges');
	for (iRow = 0, iRowLen = this._cells.length; iRow < iRowLen; ++iRow) {
		row = this._cells[iRow];
		rowRanges = [];
		for (iBlock = 0, iBlockLen = row.length; iBlock < iBlockLen; ++iBlock) {
			block = row[iBlock];

			if (!outRange) {
				outRange = {
					s: block.attr('data-state'),
					state: this.model_retrieveState(block.attr('data-state')),
					day: iRow,
					start: this._convertIndexToHour(iBlock, false),
					startIndex: iBlock,
					startBlock: row[iBlock]
				};
			}
			else if (block.attr('data-state') !== outRange.s) {

				if (outRange.s !== '') {
					outRange.end = this._convertIndexToHour(iBlock, true);
					outRange.endIndex = iBlock - 1;
					outRange.endBlock = row[iBlock - 1];
					rowRanges.push(outRange);
				}

				outRange = {
					s: block.attr('data-state'),
					state: this.model_retrieveState(block.attr('data-state')),
					day: iRow,
					start: this._convertIndexToHour(iBlock, false),
					startIndex: iBlock,
					startBlock: row[iBlock]
				};
			}
		}

		// if a range is opened --> close and store data
		if (outRange && outRange.s != '') {
			outRange.end = this._convertIndexToHour(iBlock, true);
			outRange.endIndex = iBlockLen - 1;
			outRange.endBlock = row[iBlockLen - 1];
			rowRanges.push(outRange);
		}
		outRange = null;

		// copy row ranges
		out.week[iRow] = [];
		for (iRange = 0, iRangeLen = rowRanges.length; iRange < iRangeLen; ++iRange) {
			out.ranges.push(rowRanges[iRange]);
			out.week[iRow].push({
				s: rowRanges[iRange].s,
				start: rowRanges[iRange].start,
				end: rowRanges[iRange].end
			});
		}
	}
	// console.timeEnd('model_retrieveRanges');
	return out;
};


UIPlanning.prototype._convertHourToIndex = function (s) {
	var tokens = s.split(':'),
		h = parseInt(tokens[0]),
		m = parseInt(tokens[1]);
	if (m % (60 / this._options.hourParts) !== 0)
		m += 1;
	return (h * this._options.hourParts) + (m / (60 / this._options.hourParts));
};
UIPlanning.prototype._convertIndexToHour = function (i, offset) {
	var h, m, s;
	h = Math.floor(i / this._options.hourParts);
	m = 60 / this._options.hourParts * (i % this._options.hourParts);
	if (offset === true) {
		m = (m - 1 + 60) % 60;
		if (m === 59)
			h -= 1;
	}
	h = (h + 24) % 24;

	h = h.toString();
	m = m.toString();

	s = '';
	s += (h.length < 2) ? '0' + h : h;
	s += ':';
	s += (m.length < 2) ? '0' + m : m;
	return s;
};
