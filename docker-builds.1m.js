#!/usr/bin/env /usr/local/bin/node

/**
 *
 * @type {*[{func: functionToProcessResponse, url: the url of the build, web: the live url to view}]}
 */
const monitorUrls = [];

const STATUS_COMPLETE = "complete";
const STATUS_ERROR = "error";
const STATUS_WAITING = "waiting";
const STATUS_BUILD_SCHEDULED = "build-scheduled";
const STATUS_BUILDING = "building";
const STATUS_UNKNOWN = "unknown";

const icons = {
	[STATUS_COMPLETE]: ":white_check_mark:",
	[STATUS_ERROR]: ":warning:️",
	[STATUS_WAITING]:  ":hand:️",
	[STATUS_BUILD_SCHEDULED]:  ":hourglass_flowing_sand:️",
	[STATUS_BUILDING]: ":construction_worker:",
	[STATUS_UNKNOWN]: ":trollface:",
};

let promises = [];
monitorUrls.forEach(monitor => {
	promises.push(getContent(monitor));
});
Promise.all(promises).then(results => {
	let title = "";
	let body = "";
	results.forEach(result => {
		let icon = icons.hasOwnProperty(result.status) ? icons[result.status] : icons[STATUS_UNKNOWN];
		let color = result.status === STATUS_ERROR ? "red" : result.status === STATUS_COMPLETE ? "green" : "white";
		body += `${icon} ${result.name} - ${dateFormat (result.started, "%Y-%m-%d %H:%M", false)} | href=${result.monitor.web} color=${color}\n${result.status} | alternate=true\n`;
		title += icon;
	});
	title += "\n---\n";
	body = title + body;
	console.log(body);
}).catch(e => {
	console.log(e);
});


function parseDockerHub(json, monitor) {
	let parsed = JSON.parse(json);
	let latest = parsed.results.pop();
	let name = parsed.next.replace("https://hub.docker.com/v2/repositories/", "").replace(/\/buildhistory.*/, "");
	let status = "unknown";
	let started = new Date(latest.created_date);
	switch (latest.status) {
		case 10:
			status = STATUS_COMPLETE;
			break;
		case -1:
			status = STATUS_ERROR;
			break;
		case 0:
			status = STATUS_WAITING;
			break;
		case 2:
		case 3:
			status = STATUS_BUILDING;
			break;
		default:
			status = latest.status;

	}
	return {
		name, status, started, monitor
	};

}

function parseQuay(json, monitor) {
	let parsed = JSON.parse(json);
	let latest = parsed.builds[0];
	let name = `${latest.repository.namespace}/${latest.repository.name}`;
	let status = `${latest.phase}`;
	let started = new Date(latest.started);

	return {
		name, status, started, monitor
	};
}

/**
 * Generic get request
 * @param monitor
 * @return {Promise}
 */
function getContent(monitor) {
	const {url, func, web} = monitor;
	// return new pending promise
	return new Promise((resolve, reject) => {
		// select http or https module, depending on reqested url
		const lib = url.startsWith("https") ? require("https") : require("http");
		const request = lib.get(url, { headers: { "Content-Type": "application/json" } }, (response) => {
			// handle http errors
			if (response.statusCode < 200 || response.statusCode > 299) {
				reject(new Error("Failed to load page " + url + ", status code: " + response.statusCode));
			}
			// temporary data holder
			const body = [];
			// on every content chunk, push it to the data array
			response.on("data", (chunk) => body.push(chunk));
			// we are done, resolve promise with those joined chunks
			response.on("end", () => resolve(func(body.join(""), monitor)));
		});
		// handle connection errors of the request
		request.on("error", (err) => reject(err))
	})
};

function dateFormat (date, fstr, utc) {
	utc = utc ? 'getUTC' : 'get';
	return fstr.replace (/%[YmdHMS]/g, function (m) {
		switch (m) {
			case '%Y': return date[utc + 'FullYear'] (); // no leading zeros required
			case '%m': m = 1 + date[utc + 'Month'] (); break;
			case '%d': m = date[utc + 'Date'] (); break;
			case '%H': m = date[utc + 'Hours'] (); break;
			case '%M': m = date[utc + 'Minutes'] (); break;
			case '%S': m = date[utc + 'Seconds'] (); break;
			default: return m.slice (1); // unknown code, remove %
		}
		// add leading zero if required
		return ('0' + m).slice (-2);
	});
}