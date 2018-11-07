var GVPlanning = function (selector, options) {

	// ##########################################

	// --- options

	this._o = Object.assign({
		feedbackCallback: null,
		hourFrom: 0,
		hourTo: 24,
		hourParts: 4,
		days: [],
		states: [],
		stateDefault: null,
		stateSelectedDefault: null,
	}, options);

	if(!this._o.stateDefault)
		this._o.stateDefault = this._o.states[0];
	else if(typeof this._o.stateDefault === 'string')
		this._o.stateDefault = this.model_getState(this._o.stateDefault);


	// --- variables initialization

	this._cbs = {
		model_setState: this.model_setState.bind(this),
		ux_unsetHover: this.ux_unsetHover.bind(this),
		ux_colState: this.ux_colState.bind(this),
		ux_colHover: this.ux_colHover.bind(this),
		ux_rowState: this.ux_rowState.bind(this),
		ux_rowHover: this.ux_rowHover.bind(this),
		ux_blockState: this.ux_blockState.bind(this),
		ux_blockStateWatch: this.ux_blockStateWatch.bind(this),
	};

	this._state = null;

	// allow developper to lock rendering during extensive update processes
	this._rangesRenderLock = false;
	// while dragging to "paint" in block-type cells, store the position of the drag start position
	this._dragStartCell = null;
	// store all ranges settings
	this._planning = {
		ranges: [],
		week: [],
	};
	
	// ########################################## INIT INSTANCE

	this._domEl = $(selector)
		.addClass('gvp');
	this._containerEl = this._domEl.find('.gvp-container');
	this._controlsEl = this._domEl.find('.gvp-controls');

	this.dom_build();

	this.ux_interactions();


	// --- if a configuration is set ==> display it
	if (this._o.planning) {
		this.model_restore();
	}
	if (this._o.stateSelectedDefault) {
		this.model_setState(this._o.stateSelectedDefault);
	}
};
var p = GVPlanning.prototype;


p.ux_interactions = function () {
	this._containerEl

	// --- complete day
		.on('click', '.gvp__day', this._cbs.ux_rowState)
		.on('mouseover', '.gvp__day', this._cbs.ux_rowHover)
		.on('mouseleave', '.gvp__day', this._cbs.ux_unsetHover)

		// ---	complete hour
		.on('click', '.gvp__hour', this._cbs.ux_colState)
		.on('mouseover', '.gvp__hour', this._cbs.ux_colHover)
		.on('mouseleave', '.gvp__hour', this._cbs.ux_unsetHover)

		// ---	hour part
		.on('click', '.gvp__hour-part', this._cbs.ux_colState)
		.on('mouseover', '.gvp__hour-part', this._cbs.ux_colHover)
		.on('mouseleave', '.gvp__hour-part', this._cbs.ux_unsetHover)

		// --- element
		.on('mousedown', '.gvp__block', this._cbs.ux_blockStateWatch)
	;

	this._controlsEl
		.on('click', '.gvp-state-selector', this._cbs.model_setState)
	;
};
p.ux_error = function (message, level) {
	if(this._o.feedbackCallback){
		this._o.feedbackCallback(message, level);
	}
	console.log('[' + level + ']', message);
};
p.ux_blockStateWatch = function (e) {
	if (!this._state) {
		this.ux_error('no-state-selected');
		return;
	}
	if (e.button && e.button === 2) {
		return;
	}

	if (e.type === 'mousedown') {
		this._containerEl
			.on('mouseover', '.gvp__block', this._cbs.ux_blockState);
		$(document)
			.on('mouseup', this._cbs.ux_blockStateWatch);
		$(window)
			.on('mouseup', this._cbs.ux_blockStateWatch);

		this.ux_blockState(e);
	}
	else{
		// release drag lock
		this._dragStartCell = null;

		this._containerEl
			.off('mouseover', '.gvp__block', this._cbs.ux_blockState);
		$(document)
			.off('mouseup', this._cbs.ux_blockStateWatch);
		$(window)
			.off('mouseup', this._cbs.ux_blockStateWatch);
	}
};
p.ux_blockState = function (e) {
	var block, row, xBlock, yBlock, selBlocks;

	if (!this._state) {
		this.ux_error('no-state-selected');
		return;
	}

	block = $(e.target);
	row = block.parent('.gvp-row__day');
	xBlock = row.find('.gvp__block').index(block);
	yBlock = parseInt(row.attr('data-day-index'));

	if(!this._dragStartCell){
		this._dragStartCell = {
			x: xBlock,
			y: yBlock
		};
	}
	else if(yBlock != this._dragStartCell.y){
		return;
	}

	selBlocks = this._cellsByDay[yBlock].slice(
		Math.min(xBlock, this._dragStartCell.x),
		Math.max(xBlock, this._dragStartCell.x)
	);
	this.dom_setBlocksState(selBlocks, this._state);
};
p.ux_unsetHover = function () {
	this._cellsAll.removeClass('gvp--target-hover');
};
p.ux_rowSelect = function (e) {
	return $(e.target).closest('.gvp-row').find('.gvp__block');
};
p.ux_rowHover = function (e) {
	this.ux_unsetHover();
	this.ux_rowSelect(e).addClass('gvp--target-hover');
};
p.ux_rowState = function (e) {
	if (!this._state) {
		this.ux_error('no-state-selected');
		return;
	}
	this.dom_setBlocksState(this.ux_rowSelect(e), this._state);
};
p.ux_colSelect = function (e) {
	var el = $(e.target), index, selectors;

	// ---	complete hour
	if (el.is('.gvp__hour')) {
		index = el.closest('.gvp-row').find('.gvp__hour').index(el);
		selectors = [];
		for (var i = index * this._o.hourParts, iLen = i + this._o.hourParts; i < iLen; ++i) {
			selectors.push('.gvp__block:eq(' + i + ')');
		}
		return $('.gvp-row__day').find(selectors.join(', '));
	}
	// ---	hour parts
	else if (el.is('.gvp__hour-part')) {
		index = el.closest('.gvp-row').find('.gvp__hour-part').index(el);
		return $('.gvp-row__day').find('.gvp__block:eq(' + index + ')');

	}
};
p.ux_colHover = function (e) {
	this.ux_unsetHover();
	this.ux_colSelect(e).addClass('gvp--target-hover');
};
p.ux_colState = function (e) {
	if (!this._state) {
		this.ux_error('no-state-selected');
		return;
	}
	this.dom_setBlocksState(this.ux_colSelect(e), this._state);
};


p.dom_setBlocksState = function (blocks, state) {
	if (!blocks || blocks.length === 0) {
		this.ux_error('no-target');
		return;
	}

	blocks.attr('data-state', state ? state.uid : null);

	// render is lock --> skip render
	if (!this._rangesRenderLock) {
		this.dom_renderRanges();
	}
};
p.dom_renderRanges = function () {
	var self = this,
		str,
		ranges, iRange, iRangeLen, range;

	// console.time('dom_renderRanges');

	// no drag process running, remove former ranges elements
	if(this._dragStartCell){
		this._containerEl
			.find('.gvp-row__day[data-day-index="' + this._dragStartCell.y + '"]')
			.find('.gvp__range')
			.remove();
	}
	else{
		this._containerEl
			.find('.gvp__range')
			.remove();
	}

	ranges = this.model_retrieveRanges().ranges;
	for (iRange = 0, iRangeLen = ranges.length; iRange < iRangeLen; ++iRange) {
		range = ranges[iRange];

		if(this._dragStartCell){
			if(range.day !== this._dragStartCell.y)
				continue;
			range.startBlock.find('.gvp__range').remove();
		}

		// --- create tooltip instance
		str = '<div class="gvp__range">';
		str += '<div class="gvp__range-area"></div>';
		str += '<div class="gvp__range-tooltip">' + range.start + ' - ' + range.end + '</div>';
		str += '</div>';
		range.tipEl = $(str);

		range.tipEl
			.css({
				width: range.endBlock.offset().left - range.startBlock.offset().left + range.startBlock.width()
			})
			.appendTo(range.startBlock)
			.find('.gvp__range-area')
				.css({
					'background-color': range.state.color,
				});

		(function(range){
			for(var a = range.startIndex; a <= range.endIndex; a++){
				self._cellsGridArr[range.day][a]
					.on('mouseover', function(){
						range.tipEl.addClass('show-tooltip');
					})
					.on('mouseout', function(){
						range.tipEl.removeClass('show-tooltip');
					});
			}
		}(range));
	}

	// console.timeEnd('dom_renderRanges');
};
p.dom_build = function () {
	var str,
		self = this,
		i, iLen,
		iDay, iDayLen,
		classes,
		dayCells,
		iHour, iHourMod, iHourLen;


	// ##################### BUILD STATES SELECTORS

	str = '';
	for (i = 0, iLen = this._o.states.length; i < iLen; ++i) {
		str += '<div class="gvp-state-selector" data-state="' + this._o.states[i].uid + '">'
			+ '<span class="bullet" style="background-color: ' + this._o.states[i].color + ';"></span>'
			+ this._o.states[i].label
			+ '</div>';
	}
	this._controlsEl.find('.controls-selectors').append(str);


	// ##################### BUILD GRID

	str = '';
	iHourLen = 24 * this._o.hourParts;

	// ---	hours display

	str += '<div class="gvp-row gvp-row__hours">';
	str += '<div></div>';
	for (iHour = 0; iHour < iHourLen; iHour++) {
		iHourMod = iHour % this._o.hourParts;
		if (iHourMod === 0) {
			str += '<div class="gvp__hour gvp--hour-start';
			if(iHour > 0 && (iHour / this._o.hourParts) % 6 == 0){
				str += '-xl';
			}
			str += '">' + Math.ceil(iHour / this._o.hourParts) + 'h';
		}
		else if (iHourMod === (this._o.hourParts - 1))
			str += '</div>';
	}
	str += '</div>';


	str += '<div class="gvp-row gvp-row__hour-parts">';
	str += '<div></div>';
	for (iHour = 0; iHour < iHourLen; iHour++) {
		str += '<div class="gvp__hour-part';
		if(iHour > 0 && (iHour / this._o.hourParts) % 6 == 0){
			str += ' gvp--hour-start-xl';
		}
		str += '"></div>';
	}
	str += '</div>';


	// ---	days display
	for (iDay = 0, iDayLen = this._o.days.length; iDay < iDayLen; iDay++) {
		str += '<div class="gvp-row gvp-row__day" data-day-index="' + iDay + '">';
		str += '<div class="gvp__day">' + this._o.days[iDay] + '</div>';
		for (iHour = 0; iHour < iHourLen; iHour++) {
			classes = 'gvp__block';
			if (iHour % this._o.hourParts === 0) {
				classes += (iHour > 0 && ((iHour / this._o.hourParts) % 6 == 0)) ? ' gvp--hour-start-xl' : ' gvp--hour-start';
			}
			str += '<div class="' + classes + '"></div>';
		}
		str += '</div>';
	}

	this._containerEl.append($(str));


	// --- store all cells

	this._cellsGridArr = [];
	this._cellsByDay = [];
	this._containerEl.find('.gvp-row__day').each(function (rowIndex, rowEl) {
		rowEl = $(rowEl);
		dayCells = [];
		rowEl.find('.gvp__block').each(function (blockIndex, blockEl) {
			dayCells.push($(blockEl));
		});
		self._cellsGridArr.push(dayCells);
		self._cellsByDay.push(rowEl.find('.gvp__block'));
	});
	self._cellsAll = this._containerEl.find('.gvp__block');
};


p.model_getState = function (input) {
	// retrieve state from event
	if (typeof input === 'object' && input.hasOwnProperty('target')) {
		input = $(input.target).attr('data-state');
	}

	// prevent illegal calls
	if (input === null || typeof input !== 'string') {
		console.warn('[GVPlanning.model_setState] Unable to retrieve state from passed-in parameter: ', input);
		return false;
	}

	for (var i = 0, iLen = this._o.states.length; i < iLen; ++i) {
		if (this._o.states[i].uid === input) {
			return this._o.states[i];
		}
	}

	console.log('[GVPlanning.model_setState] Unable to retrieve state from UID: ', input);
	return false;
};
p.model_setState = function (state) {
	state = this.model_getState(state);
	if (state === false) {
		return;
	}

	this._state = state;
	this._controlsEl.find('.gvp-state-selector')
		.removeClass('active')
		.filter('[data-state="' + this._state.uid + '"]').addClass('active');
	this._domEl.trigger('stateSelected', {
		state: this._state
	});
};
p.model_restore = function () {
	var
		p = this._o.planning,
		iDay, iDayLen, rowDay,
		iRange, iRangeLen, range, state,
		iCell, iCellLen;

	this._rangesRenderLock = true;

	// --- day loop
	for (iDay = 0, iDayLen = this._o.days.length; iDay < iDayLen; ++iDay) {
		rowDay = this._containerEl.find('.gvp-row__day:eq(' + iDay + ')');

		// --- range loop
		for (iRange = 0, iRangeLen = p[iDay].length; iRange < iRangeLen; ++iRange) {
			range = p[iDay][iRange];
			state = this.model_getState(range.s);

			// --- cell loop
			for (iCell = this._convertHourToIndex(range.start), iCellLen = this._convertHourToIndex(range.end); iCell < iCellLen; ++iCell) {
				this.dom_setBlocksState(rowDay.find('.gvp__block:eq(' + iCell + ')'), state);
			}
		}
	}

	this._rangesRenderLock = false;
	this.dom_renderRanges();

	console.log('[GVPlanning.model_restore] import completed');
};
p.model_export = function () {
	var settings = this.model_retrieveRanges();
	console.log('model_export', JSON.stringify(settings.week));
	return settings.week;
};
p.model_retrieveRanges = function () {
	var
		stateUID,
		iDay, iDayLen, row,
		iRange, iRangeLen,
		iBlock, iBlockLen, block,
		rowRanges, outRange;

	// console.time('model_retrieveRanges');

	// --- if a drag process is running remove all ranges belonging to the drag row
	if(this._dragStartCell){
		for(iRange = this._planning.ranges.length - 1; iRange >= 0; --iRange){
			if(this._planning.ranges[iRange].day === this._dragStartCell.y){
				this._planning.ranges.splice(iRange, 1);
			}
		}
	}
	else{
		this._planning.ranges = [];
	}

	for (iDay = 0, iDayLen = this._o.days.length; iDay < iDayLen; ++iDay) {

		// --- if a drag process is running, check only the  drag row
		if(this._dragStartCell && this._dragStartCell.y !== iDay)
			continue;

		row = this._cellsGridArr[iDay];
		rowRanges = [];
		for (iBlock = 0, iBlockLen = row.length; iBlock < iBlockLen; ++iBlock) {
			block = row[iBlock];
			if (!outRange) {
				stateUID = block.attr('data-state') || this._o.stateDefault.uid;
				outRange = {
					s: stateUID,
					state: stateUID ? this.model_getState(stateUID) : this._o.stateDefault,
					day: iDay,
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

				stateUID = block.attr('data-state') || this._o.stateDefault.uid;
				outRange = {
					s: stateUID,
					state: stateUID ? this.model_getState(stateUID) : this._o.stateDefault,
					day: iDay,
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
		this._planning.week[iDay] = [];
		for (iRange = 0, iRangeLen = rowRanges.length; iRange < iRangeLen; ++iRange) {
			this._planning.ranges.push(rowRanges[iRange]);
			this._planning.week[iDay].push({
				s: rowRanges[iRange].s,
				start: rowRanges[iRange].start,
				end: rowRanges[iRange].end
			});
		}
	}
	// console.timeEnd('model_retrieveRanges');
	return this._planning;
};


p._convertHourToIndex = function (s) {
	var tokens = s.split(':'),
		h = parseInt(tokens[0]),
		m = parseInt(tokens[1]);
	if (m % (60 / this._o.hourParts) !== 0)
		m += 1;
	return (h * this._o.hourParts) + (m / (60 / this._o.hourParts));
};
p._convertIndexToHour = function (i, offset) {
	var h, m;
	h = Math.floor(i / this._o.hourParts);
	m = 60 / this._o.hourParts * (i % this._o.hourParts);
	if (offset === true) {
		m = (m - 1 + 60) % 60;
		if (m === 59)
			h -= 1;
	}
	h = (h + 24) % 24;

	h = h.toString();
	m = m.toString();
	return ((h.length < 2) ? '0' + h : h) + ':' + ((m.length < 2) ? '0' + m : m);
};