var key = require('../utils/key');
var request = require('request');
var _ = require('underscore');
var createTemplate = require('../utils/template.js').resolver

// get client keys
const keys = require('./clientKeys');

// The API that returns the in-email representation.
module.exports = function(req, res) {
	var input = req.query.text.trim();

	handleSearchString(input, req, res);
};

function handleSearchString(term, req, res) {
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
			url: term,
			headers: {
				Authorization: `Bearer ${access_token}`
			},
			json: true
		}, (err, response) => {
			if (err || response.statusCode !== 200 || !response.body) {
				res.status(500).send('Error');
				return;
			}

			console.log(response.body);
			let results;
			let data = response.body;
			const dateOptions = {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			}

			// data for album
			if (response.body.album_type) {
				results = {
					type: 'album',
					album_url: data.external_urls.spotify,
					artist_url: data.artists[0].external_urls.spotify,
					image_url: data.images[2].url,
					name: data.name,
					artist: data.artists[0].name
				}
			}

			// data for track
			else if (response.body.album) {
				results = {
					type: 'track',
					album_url: data.album.external_urls.spotify,
					image_url: data.album.images[2].url,
					name: data.name,
					song_url: data.external_urls.spotify,
					artist_url: data.artists[0].external_urls.spotify,
					artist: data.artists[0].name
				}
			}

			// data for artist
			else {
				results = {
					type: 'artist',
					artist_url: data.external_urls.spotify,
					image_url: data.images[2].url,
					name: data.name,
					followers: data.followers.total.toLocaleString()
				}
			}

			res.json({
				body: createTemplate(results)
			})
		});
	});
}

// simple function using the buffer module to return base64 for the authorization header.
function base64(str) {
	return new Buffer(str).toString('base64');
}