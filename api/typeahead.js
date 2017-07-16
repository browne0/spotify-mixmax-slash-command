var key = require('../utils/key');
var request = require('request');
var _ = require('underscore');
var createTemplate = require('../utils/template.js').typeahead;

// get client keys
const keys = require('./clientKeys');

// define options a user can choose
var options = {
	Album: "album",
	Track: "track",
	Artist: "artist"
}

// set a variable for our access token that'll be refreshed automatically by Spotify every 6 minutes
let access_token;

// The Type Ahead API.
module.exports = (req, res) => {
	var input = req.query.text.slice();

	// if user has selected option then we will prefix the option to the search string
	var selectedOption = _.find(_.keys(options), key => {
		return input.indexOf(`${key}: `) === 0;
	})

	// if user doesn't have a valid option selected, they're still deciding between track, artist or album
	if (!selectedOption) {
		var matchingOptions = _.filter(_.keys(options), option => {
			return input.trim() === '' ? true : option.toLowerCase().startsWith(input.toLowerCase());
		});

		if (matchingOptions.length === 0) {
			res.json([{
				title: 'You can only choose album, track, or artist.',
				text: ''
			}])
		}

		else {
			res.json(matchingOptions.map(option => {
				return {
					title: option,
					text: `${option}: `,
					resolve: false // don't automatically resolve and remove the text
				}
			}));
		}
		return;
	}

	// the search term is the remaining string after the option and the colon
	var valueToSearch = input.slice((selectedOption + ': ').length)

	// if they haven't started entering a value, ask them what they're searching for
	if (valueToSearch !== "") {

		// Spotify requires that we get an access token before a request. Since we're providing a clientID and secret, we don't need an OAuth Token.
		request({
			url: 'https://accounts.spotify.com/api/token',
			method: 'POST',
			headers: {
				Authorization: 'Basic ' + base64(`${keys.clientID}:${keys.clientSecret}`)
			},
			form: {
				grant_type: 'client_credentials'
			},
			json: true
		}, (err, authResponse) => {
			if (err || authResponse.statusCode !== 200 || !authResponse.body) {
				res.status(500).send('Error');
				return;
			}

			let access_token = authResponse.body.access_token;

			// add wildcards to actual search so the outputted array better matches what a user searches
			request({
				url: 'https://api.spotify.com/v1/search',
				headers: {
					Authorization: `Bearer ${access_token}`
				},
				qs: {
					q: `*${valueToSearch}*`,
					type: options[selectedOption]
				},
				json: true
			}, (err, response) => {
				if (err || response.statusCode !== 200 || !response.body) {
					res.status(500).send('Error');
					return;
				}

				// The first property return by the api is the plural version of the option we choose.
				let selection = `${options[selectedOption]}s`

				// go through array of items returned from response and return data for the templates to use for each item
				var results = _.chain(response.body[selection].items)
				.map(data => {
					return {
						title: createTemplate(data),
						text: data.href
					};
				})
				.value();

				// nothing returned from spotify api
				if (results.length === 0) {
					res.json([{
						title: `No results found for <i>"${valueToSearch}"</i>.`,
						text: ''
					}]);
				} else {
					res.json(results);
				}
			});
		});
	} else {
		// user hasn't typed in an option yet
		res.json([{
			title: `What ${options[selectedOption]} are you looking for?`,
			text: ''
		}])
	}

};

// simple function using the buffer module to return base64 for the authorization header.
function base64(str) {
	return new Buffer(str).toString('base64');
}