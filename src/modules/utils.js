import GLib from "gi://GLib";
import Soup from "gi://Soup";

/**
 * @param {String} msg The message to log
 * @param {Array} args The arguments to format the message (optional)
 * @param {Boolean} debug Log the message as debug (default: true)
 * 
 * @author: contributors of https://github.com/geoph9/hass-gshell-extension && Updated by: Tiotbenjy
 */
export function _log(msg, args = null, debug = true) {
    if (!debug) return;
    if (args) msg = msg.format.apply(msg, args);
    log(`[proxmoxvms] - ${msg}`);
}


/**
 * @param {String} type Request type (e.g. 'GET', 'POST', default: GET)
 * @param {String} url The url which you want to request
 * @param {Object} data Data that you want to send with the request (optional, must be in json format, default: null)
 * @param {String} token The token to use for the request
 * @param {Boolean} allowInvlidCa Allow invalid SSL certificates (default: false)
 * @param {Function} callback The callback for request result (optional)
 * @param {Function} on_error The callback to run on request error (optional) 
 * 
 * @author: contributors of https://github.com/geoph9/hass-gshell-extension && Updated by: Tiotbenjy
 */
export function forge_async_message(type, url, data, token, allowInvlidCa = false, callback, on_error = null) {
    // Encode data to JSON (if provided)
    if (data != null) data = JSON.stringify(data);
    _log(
        "Forge a %s message for %s (%s)",
        [type, url, data ? "with data=%s".format(data) : "without data"]
    );

    let message = Soup.Message.new(type, url);
    message.request_headers.append('Authorization', `Bearer ${token}`);
    message.request_headers.set_content_type("application/json", null);
    if (data !== null) {
        let bytes2 = GLib.Bytes.new(data);
        message.set_request_body_from_bytes('application/json', bytes2);
    }

    // Allow invalid SSL certificates
    if (allowInvlidCa) {
        _log("Allow invalid SSL certificates");

        // https://libsoup.gnome.org/libsoup-3.0/signal.Message.accept-certificate.html
        message.connect('accept-certificate', (msg, crt, err) => {
            return true;
        });
    }

    callback(message);
}


/**
 *
 * @param {String} url The url which you want to request
 * @param {String} type Request type (e.g. 'GET', 'POST', default: GET)
 * @param {Object} data Data that you want to send with the request (optional, must be in json format, default: null)
 * @param {Function} callback The callback for request result (optional)
 * @param {Function} on_error The callback to run on request error (optional)
 * @return {Object} The response of the request (returns false if the request was unsuccessful)
 * 
 * @author: contributors of https://github.com/geoph9/hass-gshell-extension && Updated by: Tiotbenjy
 */
export function send_async_request(url, type, data, token, allowInvlidCa = false, callback = null, on_error = null) {
    forge_async_message(
        type ? type : 'GET',
        url,
        data,
        token,
        allowInvlidCa,
        (message) => {
            // Initialize session
            let session = Soup.Session.new();
            session.set_timeout(5);

            try {
                _log("Sending %s request on %s...", [type, url]);
                session.send_and_read_async(
                    message,
                    GLib.PRIORITY_DEFAULT,
                    null,
                    (session, result) => {
                        _log(
                            "Handling result of %s request on %s (status: %s)...",
                            [type, url, Soup.Status.get_phrase(message.get_status())]
                        );
                        if (message.get_status() == Soup.Status.OK) {
                            result = session.send_and_read_finish(result);
                            if (!callback) {
                                _log("%s request on %s: success", [type, url]);
                                return;
                            }
                            try {
                                _log("Decoding result of %s request on %s...", [type, url]);
                                let decoder = new TextDecoder('utf-8');
                                let response = decoder.decode(result.get_data());
                                _log(
                                    "Result of %s request on %s (%s): %s", [
                                    type,
                                    url,
                                    data ? "with data=%s".format(JSON.stringify(data)) : "without data",
                                    response
                                ]);
                                _log("Run callback for %s request on %s", [type, url]);
                                callback(JSON.parse(response));
                            } catch (error) {
                                logError(error, `fail to decode result of request on ${url}.`);
                                if (on_error) on_error(error);
                            }
                        }
                        else {
                            _log(
                                "Invalid return of request on %s (status: %s)",
                                [url, Soup.Status.get_phrase(message.get_status())], false
                            );
                            if (on_error) on_error(new Error(Soup.Status.get_phrase(message.get_status())));
                        }
                    }
                );
            } catch (error) {
                logError(error, `error durring request on ${url}: ${error}`);
                if (on_error) on_error(error);
            }
        },
        (e) => {
            log(e);
            _log("Fail to build message for %s request on %s", [type, url]);
            if (on_error) on_error(e);
            return;
        }
    );
}

/**
 * makeProgressBar function to create a progress bar string
 * 
 * @param {Number} progress The progress value
 * @param {Number} total The total value
 * @param {Number} size The size of the progress bar
 * @returns {String} The progress bar string
 */
export function makeProgressBar(progress, total, size) {
    _log("[DEBUG] Progress: %s, Total: %s, Size: %s", [progress, total, size]);

    let progressRatio = Math.max(0, Math.min(progress / total, 1)); // Clamp ratio between 0 and 1
    let progressSize = Math.floor(progressRatio * size);
    
    _log("[DEBUG] Progress Size: %s", [progressSize]);

    let progressBar = "[" + "|".repeat(progressSize) + " ".repeat(size - progressSize) + "]";
    return progressBar;
}

/**
 * Convert a value between units (B, KB, MB, GB, TB) or auto-select the best unit.
 * 
 * @param {number} value - The value to convert.
 * @param {boolean} [auto=false] - Whether to automatically select the best unit.
 * @param {string} [from="B"] - The unit to convert from.
 * @param {string} [to="B"] - The unit to convert to.
 * @returns {Object} The converted value and unit.
 */
export function convertUnit(value, auto = false, from = "B", to = "B") {
    const units = ["B", "KB", "MB", "GB", "TB"];
    
    let fromIndex = units.indexOf(from);

    if (auto) {
        let toIndex = fromIndex;
        while (value >= 1024 && toIndex < units.length - 1) {
            value /= 1024;
            toIndex++;
        }
        return { value: parseFloat(value.toFixed(2)), unit: units[toIndex] };
    } else {
        let toIndex = units.indexOf(to);
        const convertedValue = value / Math.pow(1024, toIndex - fromIndex);
        return { value: parseFloat(convertedValue.toFixed(2)), unit: units[toIndex] };
    }
}
