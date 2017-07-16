function MegaUtils() {
    this.logger = new MegaLogger('MegaUtils');

    if (typeof Intl !== 'undefined' && Intl.Collator) {
        this.collator = new Intl.Collator('co', {numeric: true});
    }
}

function MegaApi() {
    this.logger = new MegaLogger('MegaApi');
}
MegaApi.prototype = new FileManager();
MegaApi.prototype.constructor = MegaApi;

MegaUtils.prototype = new MegaApi();
MegaUtils.prototype.constructor = MegaUtils;

// TODO: refactor api_req-related functions here.
MegaApi.prototype.setDomain = function(aDomain, aSave) {
    apipath = 'https://' + aDomain + '/';

    if (aSave) {
        localStorage.apipath = apipath;
    }
};

MegaApi.prototype.staging = function(aSave) {
    this.setDomain('staging.api.mega.co.nz', aSave);
};

MegaApi.prototype.prod = function(aSave) {
    this.setDomain('eu.api.mega.co.nz', aSave);
};

MegaApi.prototype.req = function(params) {
    var promise = new MegaPromise();

    if (typeof params === 'string') {
        params = {a: params};
    }

    api_req(params, {
        callback: function(res) {
            if (typeof res === 'number' && res < 0) {
                promise.reject.apply(promise, arguments);
            }
            else {
                promise.resolve.apply(promise, arguments);
            }
        }
    });

    return promise;
};

/**
 * execCommandUsable
 *
 * Native browser 'copy' command using execCommand('copy').
 * Supported by Chrome42+, FF41+, IE9+, Opera29+
 * @returns {Boolean}
 */
MegaUtils.prototype.execCommandUsable = function() {
    var result;

    try {
        return document.queryCommandSupported("copy");
    }
    catch (ex) {
        try {
            result = document.execCommand('copy');
        }
        catch (ex) {
        }
    }

    return result === false;
};

/**
 * Utility that will return a sorting function (can compare numbers OR strings, depending on the data stored in the
 * obj), that can sort an array of objects.
 * @param key {String|Function} the name of the property that will be used for the sorting OR a func that will return a
 * dynamic value for the object
 * @param [order] {Number} 1 for asc, -1 for desc sorting
 * @param [alternativeFn] {Function} Optional function to be used for comparison of A and B if both are equal or
 *      undefined
 * @returns {Function}
 */
MegaUtils.prototype.sortObjFn = function(key, order, alternativeFn) {
    if (!order) {
        order = 1;
    }

    return function(a, b, tmpOrder) {
        var currentOrder = tmpOrder ? tmpOrder : order;

        if ($.isFunction(key)) {
            aVal = key(a);
            bVal = key(b);
        }
        else {
            aVal = a[key];
            bVal = b[key];
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return aVal.localeCompare(bVal) * currentOrder;
        }
        else if (typeof aVal === 'string' && typeof bVal === 'undefined') {
            return 1 * currentOrder;
        }
        else if (typeof aVal === 'undefined' && typeof bVal === 'string') {
            return -1 * currentOrder;
        }
        else if (typeof aVal === 'number' && typeof bVal === 'undefined') {
            return 1 * currentOrder;
        }
        else if (typeof aVal === 'undefined' && typeof bVal === 'number') {
            return -1 * currentOrder;
        }
        else if (typeof aVal === 'undefined' && typeof bVal === 'undefined') {
            if (alternativeFn) {
                return alternativeFn(a, b, currentOrder);
            }
            else {
                return -1 * currentOrder;
            }
        }
        else if (typeof aVal === 'number' && typeof bVal === 'number') {
            var _a = aVal || 0;
            var _b = bVal || 0;
            if (_a > _b) {
                return 1 * currentOrder;
            }
            if (_a < _b) {
                return -1 * currentOrder;
            }
            else {
                if (alternativeFn) {
                    return alternativeFn(a, b, currentOrder);
                }
                else {
                    return 0;
                }
            }
        }
        else {
            return 0;
        }
    };
};


/**
 * This is an utility function that would simply do a localCompare OR use Intl.Collator for comparing 2 strings.
 *
 * @param stringA {String} String A
 * @param stringB {String} String B
 * @param direction {Number} -1 or 1, for inversing the direction for sorting (which is most of the cases)
 * @returns {Number}
 */
MegaUtils.prototype.compareStrings = function megaUtilsCompareStrings(stringA, stringB, direction) {

    if (this.collator) {
        return this.collator.compare(stringA || '', stringB || '') * direction;
    }

    return (stringA || '').localeCompare(stringB || '') * direction;
};

/**
 * Promise-based XHR request
 * @param {Object|String} aURLOrOptions   URL or options
 * @param {Object|String} [aData]         Data to send, optional
 * @returns {MegaPromise}
 */
MegaUtils.prototype.xhr = function megaUtilsXHR(aURLOrOptions, aData) {
    /* jshint -W074 */
    var xhr;
    var url;
    var method;
    var options;
    var promise = new MegaPromise();

    if (typeof aURLOrOptions === 'object') {
        options = aURLOrOptions;
        url = options.url;
    }
    else {
        options = {};
        url = aURLOrOptions;
    }
    aURLOrOptions = undefined;

    aData = options.data || aData;
    method = options.method || (aData && 'POST') || 'GET';

    xhr = getxhr();

    if (typeof options.prepare === 'function') {
        options.prepare(xhr);
    }

    xhr.onloadend = function(ev) {
        if (this.status === 200) {
            promise.resolve(ev, this.response);
        }
        else {
            promise.reject(ev);
        }
    };

    try {
        if (d) {
            MegaLogger.getLogger('muXHR').info(method + 'ing', url, options, aData);
        }
        xhr.open(method, url);

        if (options.type) {
            xhr.responseType = options.type;
            if (xhr.responseType !== options.type) {
                xhr.abort();
                throw new Error('Unsupported responseType');
            }
        }

        if (typeof options.beforeSend === 'function') {
            options.beforeSend(xhr);
        }

        if (is_chrome_firefox) {
            xhr.setRequestHeader('Origin', getBaseUrl(), false);
        }

        xhr.send(aData);
    }
    catch (ex) {
        promise.reject(ex);
    }

    xhr = options = undefined;

    return promise;
};

/**
 *  Retrieve a call stack
 *  @return {String}
 */
MegaUtils.prototype.getStack = function megaUtilsGetStack() {
    var stack;

    if (is_chrome_firefox) {
        stack = Components.stack.formattedStack;
    }

    if (!stack) {
        stack = (new Error()).stack;

        if (!stack) {
            try {
                throw new Error();
            }
            catch (e) {
                stack = e.stack;
            }
        }
    }

    return stack;
};

/**
 *  Check whether there are pending transfers.
 *
 *  @return {Boolean}
 */
MegaUtils.prototype.hasPendingTransfers = function megaUtilsHasPendingTransfers() {
    return ((fminitialized && ulmanager.isUploading) || dlmanager.isDownloading);
};

/**
 * On transfers completion cleanup
 */
MegaUtils.prototype.resetUploadDownload = function megaUtilsResetUploadDownload() {
    if (!ul_queue.some(isQueueActive)) {
        ul_queue = new UploadQueue();
        ulmanager.isUploading = false;
        ASSERT(ulQueue._running === 0, 'ulQueue._running inconsistency on completion');
        ulQueue._pending = [];
        ulQueue.setSize((fmconfig.ul_maxSlots | 0) || 4);

        if (page !== 'download') {
            mega.ui.tpp.reset('ul');
        }
    }
    else {
        if (page !== 'download') {
            mega.ui.tpp.statusPaused(ul_queue, 'ul');
        }
    }
    if (!dl_queue.some(isQueueActive)) {
        dl_queue = new DownloadQueue();
        dlmanager.isDownloading = false;

        delay.cancel('overquota:retry');
        delay.cancel('overquota:uqft');

        dlmanager._quotaPushBack = {};
        dlmanager._dlQuotaListener = [];

        if (page !== 'download') {
            mega.ui.tpp.reset('dl');
        }
    }
    else {
        if (page !== 'download') {
            mega.ui.tpp.statusPaused(dl_queue, 'dl');
        }
    }

    if (!dlmanager.isDownloading && !ulmanager.isUploading) {
        /* destroy all xhr */
        clearTransferXHRs();

        $('.transfer-pause-icon').addClass('disabled');
        $('.nw-fm-left-icon.transfers').removeClass('transfering');
        $('.transfers .nw-fm-percentage li p').css('transform', 'rotate(0deg)');
        M.tfsdomqueue = Object.create(null);
        GlobalProgress = Object.create(null);
        delete $.transferprogress;
        if (page !== 'download') {
            fm_tfsupdate();
        }
        if ($.mTransferAnalysis) {
            clearInterval($.mTransferAnalysis);
            delete $.mTransferAnalysis;
        }
        $('.transfer-panel-title').text('');
        dlmanager.dlRetryInterval = 3000;
        percent_megatitle();
    }

    if (d) {
        dlmanager.logger.info("resetUploadDownload", ul_queue.length, dl_queue.length);
    }

    if (page === 'download') {
        delay('percent_megatitle', percent_megatitle);
    }
};

/**
 *  Abort all pending transfers.
 *
 *  @return {MegaPromise}
 *          Resolved: Transfers were aborted
 *          Rejected: User canceled confirmation dialog
 *
 *  @details This needs to be used when an operation requires that
 *           there are no pending transfers, such as a logout.
 */
MegaUtils.prototype.abortTransfers = function megaUtilsAbortTransfers() {
    var promise = new MegaPromise();

    var abort = function() {
        // if (mBroadcaster.crossTab.master || page === 'download' || u_type !== 3) {
            if (!M.hasPendingTransfers()) {
                promise.resolve();
            }
            else {
                msgDialog('confirmation', l[967], l[377] + ' ' + l[507] + '?', false, function(doIt) {
                    if (doIt) {
                        if (dlmanager.isDownloading) {
                            dlmanager.abort(null);
                        }
                        if (ulmanager.isUploading) {
                            ulmanager.abort(null);
                        }

                        M.resetUploadDownload();
                        loadingDialog.show();
                        var timer = setInterval(function() {
                            if (!M.hasPendingTransfers()) {
                                clearInterval(timer);
                                promise.resolve();
                            }
                        }, 350);
                    }
                    else {
                        promise.reject();
                    }
                });
            }
        /*}
        else {
            promise.reject();
        }*/
    };

    if (u_type > 2 && (!mBroadcaster.crossTab.master || mBroadcaster.crossTab.slaves.length)) {
        msgDialog('warningb', l[882], l[7157], 0, abort);
    }
    else {
        abort();
    }

    return promise;
};

/**
 *  Reload the site cleaning databases & session/localStorage.
 *
 *  Under non-activated/registered accounts this
 *  will perform a former normal cloud reload.
 */
MegaUtils.prototype.reload = function megaUtilsReload() {
    function _reload() {
        var u_sid = u_storage.sid;
        var u_key = u_storage.k;
        var privk = u_storage.privk;
        var jj = localStorage.jj;
        var debug = localStorage.d;
        var lang = localStorage.lang;
        var mcd = localStorage.testChatDisabled;
        var apipath = debug && localStorage.apipath;

        localStorage.clear();
        sessionStorage.clear();

        if (u_sid) {
            u_storage.sid = u_sid;
            u_storage.privk = privk;
            u_storage.k = u_key;
            localStorage.wasloggedin = true;
        }

        if (debug) {
            localStorage.d = 1;
            localStorage.minLogLevel = 0;

            if (location.host !== 'mega.nz') {
                localStorage.dd = true;
                if (!is_extension && jj) {
                    localStorage.jj = jj;
                }
            }
            if (apipath) {
                // restore api path across reloads, only for debugging purposes...
                localStorage.apipath = apipath;
            }
        }

        if (mcd) {
            localStorage.testChatDisabled = 1;
        }
        if (lang) {
            localStorage.lang = lang;
        }
        if (hashLogic) {
            localStorage.hashLogic = 1;
        }

        localStorage.force = true;
        location.reload(true);
    }

    if (u_type !== 3 && page !== 'download') {
        stopsc();
        stopapi();
        loadfm(true);
    }
    else {
        // Show message that this operation will destroy the browser cache and reload the data stored by MEGA
        msgDialog('confirmation', l[761], l[7713], l[6994], function(doIt) {
            if (doIt) {
                M.abortTransfers().then(function() {
                    loadingDialog.show();
                    stopsc();
                    stopapi();

                    MegaPromise.allDone([
                        M.clearFileSystemStorage()
                    ]).then(function(r) {
                        console.debug('megaUtilsReload', r);

                        if (fmdb) {
                            fmdb.invalidate(_reload);
                        }
                        else {
                            _reload();
                        }
                    });
                });
            }
        });
    }
};

/**
 * Clear the data on FileSystem storage.
 *
 * M.clearFileSystemStorage().always(console.debug.bind(console));
 */
MegaUtils.prototype.clearFileSystemStorage = function megaUtilsClearFileSystemStorage() {
    function _done(status) {
        if (promise) {
            if (status !== 0x7ffe) {
                promise.reject(status);
            }
            else {
                promise.resolve();
            }
            promise = undefined;
        }
    }

    if (is_chrome_firefox || !window.requestFileSystem) {
        return MegaPromise.resolve();
    }

    setTimeout(function() {
        _done();
    }, 4000);

    var promise = new MegaPromise();

    (function _clear(storagetype) {
        function onInitFs(fs) {
            var dirReader = fs.root.createReader();
            dirReader.readEntries(function(entries) {
                for (var i = 0, entry; entry = entries[i]; ++i) {
                    if (entry.isDirectory && entry.name === 'mega') {
                        console.debug('Cleaning storage...', entry);
                        entry.removeRecursively(_next.bind(null, 0x7ffe), _next);
                        break;
                    }
                }
            });
        }

        function _next(status) {
            if (storagetype === 0) {
                _clear(1);
            }
            else {
                _done(status);
            }
        }

        window.requestFileSystem(storagetype, 1024, onInitFs, _next);
    })(0);

    return promise;
};

/**
 * Neuter an ArrayBuffer
 * @param {Mixed} ab ArrayBuffer/TypedArray
 */
MegaUtils.prototype.neuterArrayBuffer = function neuter(ab) {
    if (!(ab instanceof ArrayBuffer)) {
        ab = ab && ab.buffer;
    }
    try {
        if (typeof ArrayBuffer.transfer === 'function') {
            ArrayBuffer.transfer(ab, 0); // ES7
        }
        else {
            if (!neuter.dataWorker) {
                neuter.dataWorker = new Worker("data:application/javascript,var%20d%3B");
            }
            neuter.dataWorker.postMessage(ab, [ab]);
        }
        if (ab.byteLength !== 0) {
            throw new Error('Silently failed! -- ' + ua);
        }
    }
    catch (ex) {
        if (d > 1) {
            console.warn('Cannot neuter ArrayBuffer', ab, ex);
        }
    }
};

/**
 * Resources loader through our secureboot mechanism
 * @param {...*} var_args  Resources to load, either plain filenames or jsl2 members
 * @return {MegaPromise}
 */
MegaUtils.prototype.require = function megaUtilsRequire() {
    var files = [];
    var args = [];
    var logger = d && MegaLogger.getLogger('require', 0, this.logger);

    toArray.apply(null, arguments).forEach(function(rsc) {
        // check if a group of resources was provided
        if (jsl3[rsc]) {
            var group = Object.keys(jsl3[rsc]);

            args = args.concat(group);

            // inject them into jsl2
            for (var i = group.length; i--;) {
                if (!jsl2[group[i]]) {
                    (jsl2[group[i]] = jsl3[rsc][group[i]]).n = group[i];
                }
            }
        }
        else {
            args.push(rsc);
        }
    });

    args.forEach(function(file) {

        // If a plain filename, inject it into jsl2
        // XXX: Likely this will have a conflict with our current build script
        if (!jsl2[file]) {
            var filename = file.replace(/^.*\//, '');
            var extension = filename.split('.').pop().toLowerCase();
            var name = filename.replace(/\./g, '_');
            var type;

            if (extension === 'html') {
                type = 0;
            }
            else if (extension === 'js') {
                type = 1;
            }
            else if (extension === 'css') {
                type = 2;
            }

            jsl2[name] = {f: file, n: name, j: type};
            file = name;
        }

        if (!jsl_loaded[jsl2[file].n]) {
            files.push(jsl2[file]);
        }
    });

    if (files.length === 0) {
        // Everything is already loaded
        if (logger) {
            logger.debug('Nothing to load.', args);
        }
        return MegaPromise.resolve();
    }

    if (megaUtilsRequire.loading === undefined) {
        megaUtilsRequire.pending = [];
        megaUtilsRequire.loading = Object.create(null);
    }

    var promise = new MegaPromise();
    var rl = megaUtilsRequire.loading;
    var rp = megaUtilsRequire.pending;
    var loading = Object.keys(rl).length;

    // Check which files are already being loaded
    for (var i = files.length; i--;) {
        var f = files[i];

        if (rl[f.n]) {
            // loading, remove it.
            files.splice(i, 1);
        }
        else {
            // not loading, track it.
            rl[f.n] = M.getStack();
        }
    }

    // hold up if other files are loading
    if (loading) {
        rp.push([files, promise]);

        if (logger) {
            logger.debug('Queueing %d files...', files.length, args);
        }
    }
    else {

        (function _load(files, promise) {
            var onload = function() {
                // all files have been loaded, remove them from the tracking queue
                for (var i = files.length; i--;) {
                    delete rl[files[i].n];
                }

                if (logger) {
                    logger.debug('Finished loading %d files...', files.length, files);
                }

                // resolve promise, in a try/catch to ensure the caller doesn't mess us..
                try {
                    promise.resolve();
                }
                catch (ex) {
                    (logger || console).error(ex);
                }

                // check if there is anything pending, and fire it.
                var pending = rp.shift();

                if (pending) {
                    _load.apply(null, pending);
                }
            };

            if (logger) {
                logger.debug('Loading %d files...', files.length, files);
            }

            if (!files.length) {
                // nothing to load
                onload();
            }
            else {
                Array.prototype.push.apply(jsl, files);
                silent_loading = onload;
                jsl_start();
            }
        })(files, promise);
    }
    return promise;
};

/**
 *  Kill session and Logout
 */
MegaUtils.prototype.logout = function megaUtilsLogout() {
    M.abortTransfers().then(function() {
        var finishLogout = function() {
            if (--step === 0) {
                u_logout(true);
                location.reload();
            }
        }, step = 1;

        loadingDialog.show();
        if (fmdb && fmconfig.dbDropOnLogout) {
            step++;
            fmdb.drop().always(finishLogout);
        }
        if (!megaChatIsDisabled) {
            if (typeof(megaChat) !== 'undefined' && typeof(megaChat.userPresence) !== 'undefined') {
                megaChat.userPresence.disconnect();
            }
        }
        if (u_privk && !loadfm.loading) {
            // Use the 'Session Management Logout' API call to kill the current session
            api_req({'a': 'sml'}, {callback: finishLogout});
        }
        else {
            finishLogout();
        }
    });
};

/**
 * Convert a version string (eg, 2.1.1) to an integer, for easier comparison
 * @param {String}  version The version string
 * @param {Boolean} hex     Whether give an hex result
 * @return {Number|String}
 */
MegaUtils.prototype.vtol = function megaUtilsVTOL(version, hex) {
    version = String(version).split('.');

    while (version.length < 4) {
        version.push(0);
    }

    version = ((version[0] | 0) & 0xff) << 24 |
        ((version[1] | 0) & 0xff) << 16 |
        ((version[2] | 0) & 0xff) << 8 |
        ((version[3] | 0) & 0xff);

    version >>>= 0;

    if (hex) {
        return version.toString(16);
    }

    return version;
};

/**
 * Retrieve data from storage servers.
 * @param {String|Object} aData           ufs-node's handle or public link
 * @param {Number}        [aStartOffset]  offset to start retrieveing data from
 * @param {Number}        [aEndOffset]    retrieve data until this offset
 * @param {Function}      [aProgress]     callback function which is called with the percent complete
 * @returns {MegaPromise}
 */
MegaUtils.prototype.gfsfetch = function gfsfetch(aData, aStartOffset, aEndOffset, aProgress) {
    var promise = new MegaPromise();

    var fetcher = function(data) {

        if (aEndOffset === -1) {
            aEndOffset = data.s;
        }

        aEndOffset = parseInt(aEndOffset);
        aStartOffset = parseInt(aStartOffset);

        if ((!aStartOffset && aStartOffset !== 0)
            || aStartOffset > data.s || !aEndOffset
            || aEndOffset < aStartOffset) {

            return promise.reject(ERANGE, data);
        }
        var byteOffset = aStartOffset % 16;

        if (byteOffset) {
            aStartOffset -= byteOffset;
        }

        var request = {
            method: 'POST',
            type: 'arraybuffer',
            url: data.g + '/' + aStartOffset + '-' + (aEndOffset - 1)
        };

        if (typeof aProgress === 'function') {
            request.prepare = function(xhr) {
                xhr.addEventListener('progress', function(ev) {
                    if (ev.lengthComputable) {

                        // Calculate percentage downloaded e.g. 49.23
                        var percentComplete = ((ev.loaded / ev.total) * 100);
                        var bytesLoaded = ev.loaded;
                        var bytesTotal = ev.total;

                        // Pass the percent complete to the callback function
                        aProgress(percentComplete, bytesLoaded, bytesTotal);
                    }
                }, false);
            };
        }

        M.xhr(request).done(function(ev, response) {

            data.macs = [];
            data.writer = [];

            if (!data.nonce) {
                var key = data.key;

                data.nonce = JSON.stringify([
                    key[0] ^ key[4],
                    key[1] ^ key[5],
                    key[2] ^ key[6],
                    key[3] ^ key[7],
                    key[4], key[5]
                ]);
            }

            Decrypter.unshift([
                [data, aStartOffset],
                data.nonce,
                aStartOffset / 16,
                new Uint8Array(response)
            ], function resolver() {
                try {
                    var buffer = data.writer.shift().data.buffer;

                    if (byteOffset) {
                        buffer = buffer.slice(byteOffset);
                    }

                    data.buffer = buffer;
                    promise.resolve(data);
                }
                catch (ex) {
                    promise.reject(ex);
                }
            });

        }).fail(function() {
            promise.reject.apply(promise, arguments);
        });
    };

    if (typeof aData !== 'object') {
        var key;
        var handle;

        // If a ufs-node's handle provided
        if (String(aData).length === 8) {
            handle = aData;
        }
        else {
            // if a public-link provided, eg #!<handle>!<key>
            aData = String(aData).replace(/^.*?#!/, '').split('!');

            if (aData.length === 2 && aData[0].length === 8) {
                handle = aData[0];
                key = base64_to_a32(aData[1]).slice(0, 8);
            }
        }

        if (!handle) {
            promise.reject(EARGS);
        }
        else {
            var callback = function(res) {
                if (typeof res === 'object' && res.g) {
                    res.key = key;
                    res.handle = handle;
                    fetcher(res);
                }
                else {
                    promise.reject(res);
                }
            };
            var req = {a: 'g', g: 1, ssl: use_ssl};

            if (!key) {
                req.n = handle;
                key = M.getNodeByHandle(handle).k;
            }
            else {
                req.p = handle;
            }

            if (!Array.isArray(key) || key.length !== 8) {
                promise.reject(EKEY);
            }
            else {
                api_req(req, {callback: callback}, pfid ? 1 : 0);
            }
        }
    }
    else {
        fetcher(aData);
    }

    aData = undefined;

    return promise;
};

/**
 * Returns the currently running site version depending on if in development, on the live site or if in an extension
 * @returns {String} Returns the string 'dev' if in development or the currently running version e.g. 3.7.0
 */
MegaUtils.prototype.getSiteVersion = function() {

    // Use 'dev' as the default version if in development
    var version = 'dev';

    // If this is a production version the timestamp will be set
    if (buildVersion.timestamp !== '') {

        // Use the website build version by default
        version = buildVersion.website;

        // If an extension use the version of that (because sometimes there are independent deployments of extensions)
        if (is_extension) {
            version = (window.chrome) ? buildVersion.chrome + ' ' + l[957] : buildVersion.firefox + ' ' + l[959];
        }
    }

    return version;
};

/*
 * Alert about 110% zoom level in Chrome/Chromium
 */
MegaUtils.prototype.chrome110ZoomLevelNotification = function() {

    var dpr = window.devicePixelRatio;
    var pf = navigator.platform.toUpperCase();
    var brokenRatios = [
        2.200000047683716,// 110% retina
        1.100000023841858,// 110% non-retina
        1.3320000171661377,// 67% retina
        0.6660000085830688,// 67% non-retian, 33% retina
        0.3330000042915344// 33% non-retina
    ];

    if (window.chrome) {

        $('.nw-dark-overlay').removeClass('mac');
        $('.nw-dark-overlay.zoom-overlay').removeClass('zoom-67 zoom-33');

        if (pf.indexOf('MAC') >= 0) {
            $('.nw-dark-overlay').addClass('mac');
        }

        // zoom level110%
        if ((dpr === 2.200000047683716) || (dpr === 1.100000023841858)) {
            $('.nw-dark-overlay.zoom-overlay').fadeIn(400);
        }

        // 67% both or 33% retina
        if ((dpr === 1.3320000171661377) || (dpr === 0.6660000085830688)) {
            $('.nw-dark-overlay.zoom-overlay')
                .addClass('zoom-67')
                .fadeIn(400);
        }

        // 33% non-retina
        if (dpr === 0.3330000042915344) {
            $('.nw-dark-overlay.zoom-overlay')
                .addClass('zoom-33')
                .fadeIn(400);
        }

        if (brokenRatios.indexOf(dpr) === -1) {
            $('.nw-dark-overlay.zoom-overlay').fadeOut(200);
        }
    }
};
mBroadcaster.once('startMega', function() {
    onIdle(M.chrome110ZoomLevelNotification);
});

/**
 * Fire "find duplicates"
 */
MegaUtils.prototype.findDupes = function() {
    loadingDialog.show();
    onIdle(function() {
        M.overrideModes = 1;
        loadSubPage('fm/search/~findupes');
    });
};

/**
 * Handle a redirect from the mega.co.nz/#pro page to mega.nz/#pro page
 * and keep the user logged in at the same time
 */
MegaUtils.prototype.transferFromMegaCoNz = function() {
    // Get site transfer data from after the hash in the URL
    var urlParts = /sitetransfer!(.*)/.exec(window.location);

    if (urlParts) {

        try {
            // Decode from Base64 and JSON
            urlParts = JSON.parse(atob(urlParts[1]));
        }
        catch (ex) {
            console.error(ex);
            loadSubPage('login');
            return false;
        }

        if (urlParts) {
            // If the user is already logged in here with the same account
            // we can avoid a lot and just take them to the correct page
            if (JSON.stringify(u_k) === JSON.stringify(urlParts[0])) {
                loadSubPage(urlParts[2]);
                return false;
            }

            // If the user is already logged in but with a different account just load that account instead. The
            // hash they came from e.g. a folder link may not be valid for this account so just load the file manager.
            else if (u_k && (JSON.stringify(u_k) !== JSON.stringify(urlParts[0]))) {
                if (!urlParts[2] || String(urlParts[2]).match(/^fm/)) {
                    loadSubPage('fm');
                    return false;
                }
                else {
                    loadSubPage(urlParts[2]);
                    return false;
                }
            }

            // Likely that they have never logged in here before so we must set this
            localStorage.wasloggedin = true;
            u_logout();

            // Get the page to load
            var toPage = String(urlParts[2] || 'fm').replace('#', '');

            // Set master key, session ID and RSA private key
            u_storage = init_storage(sessionStorage);
            u_k = urlParts[0];
            u_sid = urlParts[1];
            if (u_k) {
                u_storage.k = JSON.stringify(u_k);
            }

            loadingDialog.show();

            var _goToPage = function() {
                loadingDialog.hide();
                loadSubPage(toPage);
            };

            var _rawXHR = function(url, data, callback) {
                M.xhr(url, JSON.stringify([data]))
                    .always(function(ev, data) {
                        var resp;
                        if (typeof data === 'string' && data[0] === '[') {
                            try {
                                resp = JSON.parse(data)[0];
                            }
                            catch (ex) {
                            }
                        }
                        callback(resp);
                    });
            };

            // Performs a regular login as part of the transfer from mega.co.nz
            _rawXHR(apipath + 'cs?id=0&sid=' + u_sid, {'a': 'ug'}, function(data) {
                var ctx = {
                    checkloginresult: function(ctx, result) {
                        u_type = result;
                        if (toPage.substr(0, 1) === '!' && toPage.length > 7) {
                            _rawXHR(apipath + 'cs?id=0&domain=meganz',
                                {'a': 'g', 'p': toPage.substr(1, 8)},
                                function(data) {
                                    if (data) {
                                        dl_res = data;
                                    }
                                    _goToPage();
                                });
                        }
                        else {
                            _goToPage();
                        }
                    }
                };
                if (data) {
                    api_setsid(u_sid);
                    u_storage.sid = u_sid;
                    u_checklogin3a(data, ctx);
                }
                else {
                    u_checklogin(ctx, false);
                }
            });
            return false;
        }
    }
};

/** Don't report `newmissingkeys` unless there are *new* missing keys */
MegaUtils.prototype.checkNewMissingKeys = function() {
    var result = true;

    try {
        var keys = Object.keys(missingkeys).sort();
        var hash = MurmurHash3(JSON.stringify(keys));
        var prop = u_handle + '_lastMissingKeysHash';
        var oldh = parseInt(localStorage[prop]);

        if (oldh !== hash) {
            localStorage[prop] = hash;
        }
        else {
            result = false;
        }
    }
    catch (ex) {
        console.error(ex);
    }

    return result;
};

/**
 * Sanitise filename so that saving to local disk won't cause any issue...
 * @param {String} name The filename
 * @returns {String}
 */
MegaUtils.prototype.getSafeName = function(name) {
    // http://msdn.microsoft.com/en-us/library/aa365247(VS.85)
    name = ('' + name).replace(/[:\/\\<">|?*]+/g, '.').replace(/\s*\.+/g, '.');

    if (name.length > 250) {
        name = name.substr(0, 250) + '.' + name.split('.').pop();
    }
    name = name.replace(/\s+/g, ' ').trim();
    name = name.replace(/\u202E|\u200E|\u200F/g, '');

    var end = name.lastIndexOf('.');
    end = ~end && end || name.length;
    if (/^(?:CON|PRN|AUX|NUL|COM\d|LPT\d)$/i.test(name.substr(0, end))) {
        name = '!' + name;
    }
    return name;
};

/**
 * Sanitise path components so that saving to local disk won't cause any issue...
 * @param {String} path   The full path to sanitise
 * @param {String} [file] Optional filename to append
 * @returns {Array} Each sanitised path component as array members
 */
MegaUtils.prototype.getSafePath = function(path, file) {
    var res = ('' + (path || '')).split(/[\\\/]+/).map(this.getSafeName).filter(String);
    if (file) {
        res.push(this.getSafeName(file));
    }
    return res;
};

/**
 * Check Storage quota.
 * @param {Number} timeout in milliseconds, defaults to 30 seconds
 */
MegaUtils.prototype.checkStorageQuota = function checkStorageQuota(timeout) {
    delay('checkStorageQuota', function _csq() {
        M.req({a: 'uq', strg: 1, qc: 1}).done(function(data) {
            var perc = Math.floor(data.cstrg / data.mstrg * 100);

            M.showOverStorageQuota(perc, data.cstrg, data.mstrg);
        });
    }, timeout || 30000);
};
