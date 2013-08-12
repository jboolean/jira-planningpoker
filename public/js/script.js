/*================================
	Globals
=================================*/
var id,
	socket,
	gameInfo = {},
	isAdmin;
	currentStoryNo = null,
	stories = {}, //hash of ticket_no => story (new API)
	pusher_prod = 'a8a337eb4d5e4c071c6a',
	pusher_dev = '32de1f05aeb0cce00299', //will be active on localhost
	pusher_key = (document.domain == 'localhost') ? pusher_dev : pusher_prod;

/*================================
	Event listeners
=================================*/
$(document).ready(function(){

	id = getURLParameter('id');
	updateGameInfo(function() {
		updateStories(function() {
			joinGame(function() {
				console.log('end of join game');
			});
		});
	});
	$('.card').hover(function() {
		$(this).animate({
			'top': '5px'
		}, 75);
	}, function() {
		$(this).animate({
			'top': '0px'
		}, 75);
	});

	$('.result-card').hover(function() {
		var id = $(this).attr("id");
		$(this).tooltip();
	});

	$('.card').click(function() {
		var storyValue = parseInt( $(this).attr('value') );
		sendVote( storyValue );
	});

	$('#ticket').keyup(function(data){
		$(this).val($(this).val().toUpperCase().replace(/[^A-Z0-9\-]/g, ''));
		//this could be better, just hacked this out b/c I didn't want to use capslock
	});

	$('#new-ticket-btn').click(makeStory);
	$('#new-game-btn').click(makeGame);
	$('#set-score-btn').click(setScore);
	$('#flip-btn').click(flipCards);
	$('#end-game-btn').click(endGame);
	$('#clear-btn').click(deleteEstimates);
	

	/*================================
		Pusher functions
	=================================*/
	var pusher = new Pusher(pusher_key),
		channel = pusher.subscribe('game_' + id);

	channel.bind('new_story', function ( data ) {
		//data = JSON.parse(data);
		console.log('new story from pusher', data);
		stories[data.ticket_no] = data;
		/*$('#stories').empty();
		for (var i = 0; i < stories.length; i++) {
			story = stories[i];
			if(story.story_points == null) {
				story.story_points = 0;
			}
			var storyTitle = '<li>' + story.ticket_no + '&nbsp;&nbsp;:&nbsp;&nbsp;'
						   + story.story_points; + '</li>';
			$('#stories').append(storyTitle);
		};*/
		//refreshAll();
		appendStory(data);
	});

	channel.bind('updated_story', function ( data ) {
		/*if (data.flipped == false) {
			return;
		}/
		
		$('#result-cards').empty();
		for (var i = 0; i < data.estimates.length; i++) {
			estimate = data.estimates[i];
			console.log("estimate");
			console.log(estimate);
			var resultCard = "<div id='" + i + "'class='result-card' data-original-title='" 
				+ estimate.user.fullname + "'><h1>" + estimate.vote + "</h1></div>";
			$('#result-cards').append(resultCard);
			var id = '#' + i;
			$(id).tooltip();
		}*/
		stories[data.ticket_no] = data;
		refreshAll();
		
	});

	channel.bind('current_story', function ( data ) {
		console.log('pusher has a new current story', data);
		currentStoryNo = data.ticket_no
		stories[data.ticket_no] = data;
		/*
		$('#title').empty();
		$('#description').empty();
		var title = data.ticket_no + " - " + data.summary,
			description = data.description.replace('\n', '<br />');
		
		description = description.replace('\t', '');
		description = description.replace('\r', '');

		$('#title').html(title);
		$('#description').html(description);
		*/
		refreshAll();

	});

	channel.bind('estimate', function ( data ) {
		//$('#result-cards').empty();
		/*for (var i = 0; i < currentStory.estimates.length; i++) {
			estimate = currentStory.estimates[i];
			console.log("estimate");
			console.log(estimate);
			var resultCard = "<div id='" + i + "'class='result-card' data-original-title='" 
				+ estimate.user.fullname + "'></div>";
			$('#result-cards').append(resultCard);
			var id = '#' + i;
			$(id).tooltip();
		}*/
		stories[data.ticket_no].estimates.push(data);
		appendEstimate(data);
	});

	channel.bind('closed', function ( data ) {
		alert("The moderator ended this game.");
		window.location = '/gamesList';
	});
	channel.bind('joined', appendParticipant);
	channel.bind('new_round', function ( data ){
		stories[data.ticket_no].estimates = [];
		refreshAll();
	});

});

/*================================
	Ajax functions
=================================*/
function sendVote( storyValue ) {
	if (stories[currentStoryNo].flipped) {
		return;
	}
	//console.log('gameInfo before username: ', getGameInfo());
	var data = {
				vote: storyValue
			},
		ticket = currentStoryNo,
		id = getId(),
		url = '/game/' + id + '/story/' + ticket + '/estimate';

	$.ajax({
		url: url,
		type: 'POST',
		dataType: 'JSON',
		'data': data,
		success: function( data, textStatus, jqXHR ) {
			console.log( 'success!' );
		},
		error: function( jqXHR, textStatus, errorThrown ) {
			console.log( 'ERROR: ', errorThrown );
		}
	});
}

function updateGameInfo(callback) {
	var id = getId(),
		url = '/game/' + id;
		
	$.ajax({
		url: url,
		type: 'GET',
		success: function( data, textStatus, jqXHR ) {
			gameInfo = JSON.parse( data );
			//stories = gameInfo.stories;//wrong
			currentStoryNo = gameInfo['current_story'];
			//getCurrentStory();
			checkAdmin();
			console.log( 'sucessful! getGameInfo(): ', gameInfo );
			if (callback != undefined) {
				callback();
			}
			return gameInfo;
		},
		error: function( jqXHR, textStatus, errorThrown ) {
			console.log('ERROR: ', errorThrown);
			return null;
		}
	});
}

/*function getCurrentStory() {
	if(gameInfo.current_story == null) {
		getStories();
		return;
	}

	var url = '/game/' + getId() + '/story/' + currentStoryNo;

	$.ajax({
		url: url,
		type: 'GET',
		success: function( data, textStatus, jqXHR ) {
			console.log(data);
			currentStory = data;
			console.log('getCurrentStory: ', currentStory);
		},
		error: function( jqXHR, textStatus, errorThrown ) {
			console.log('ERROR: ', errorThrown);
			return null;
		}
	});
}*/

function updateStories(callback) {
	var url = '/game/' + getId() + '/story';

	$.ajax({
		url: url,
		type: 'GET',
		success: function( data, textStatus, jqXHR ) {
			stories = JSON.parse( data );
			//console.log('getstories currentstory', currentStory);
			if (callback != undefined) {
				callback()
			}
			refreshAll();
		},
		error: function( jqXHR, textStatus, errorThrown ) {
			console.log('ERROR: ', errorThrown);
			return null;
		}
	});
}

/*================================
	Admin Ajax functions
=================================*/
function deleteEstimates() {
	var url = '/game/' + getId() + '/story/' + currentStoryNo + '/estimate';

	$.ajax({
		url: url,
		type: 'DELETE',
		success: function( data, textStatus, jqXHR ) {
			stories[currentStoryNo].estimates=data;
			stories[currentStoryNo].flipped = false;
			refreshDisplayedStory();
		},
		error: function( jqXHR, textStatus, errorThrown ) {
			console.log('ERROR: ', errorThrown);
			return null;
		}
	});
}

function checkAdmin() {
	var url = '/login';

	$.ajax({
		url: url,
		type: 'GET',
		success: function( data, textStatus, jqXHR ) {
			isAdmin = data.username == gameInfo.moderator.username;
			console.log('Am I admin?', isAdmin);
			$('#admin-panel').toggle(isAdmin)
			$('.side-tickets li').toggleClass('clickable', isAdmin);
		},
		error: function( jqXHR, textStatus, errorThrown ) {
			console.log('ERROR: ', errorThrown);
			return null;
		}
	});
}

function makeGame( id, callback ) {
	var url = '/game',
		name = $('#game').val(),
		data = {
			name: name
		};

	$.ajax({
		url: url,
		type: 'POST',
		data: data,
		success: function( data, textStatus, jqXHR ) {
			gameInfo = JSON.parse( data );
			console.log('makeGame()', gameInfo);
			window.location = '/index.html?id=' + gameInfo.id;
			return gameInfo;
		},
		error: function( jqXHR, textStatus, errorThrown ) {
			console.log('ERROR: ', errorThrown);
			return null;
		}
	});
}

function makeStory() {
	var url = '/game/' + getId() + '/story',
		ticketNum = $('#ticket').val(),
		data = { 'ticket_no': ticketNum };
	console.log(ticketNum);
	$.ajax({
		url: url,
		type: 'POST',
		data: data,
		dataType: 'JSON',
		success: function( data, textStatus, jqXHR ) {
			//gameInfo = JSON.parse( data ); what?
			console.log('makeGame()', gameInfo);
			stories[data.ticket_no] = data;
			if (currentStoryNo == null){
				currentStoryNo = data.ticket_no;
				refreshAll();
			}
			//refreshAll();
			//appendStory(data);

			//remember, pusher will come in, too
			//getGameInfo();
		},
		error: function( jqXHR, textStatus, errorThrown ) {
			console.log('ERROR: ', errorThrown);
			return null;
		}
	});
}

function endGame() {
	var url = '/game/' + getId();
	$.ajax({
		url: url,
		type: 'DELETE',
		success: function( data, textStatus, jqXHR ) {
			window.location = '/gamesList';
		},
		error: function( jqXHR, textStatus, errorThrown ) {
			console.log('ERROR: ', errorThrown);
		}
	});
}

function setScore() {
	console.log(gameInfo);
	var url = '/game/' + getId() + '/story/' + currentStoryNo,
		sp = $('#score').val(),
		data = {
				story_points: sp
			};
	console.log(data);

	$.ajax({
		url: url,
		type: 'PUT',
		data: data,
		success: function( data, textStatus, jqXHR ) {
			stories[data.ticket_no] = data;//save updated story
			refreshAll();
			console.log('setScore: ', data);
		},
		error: function( jqXHR, textStatus, errorThrown ) {
			console.log('ERROR: ', errorThrown);
		}
	});
}

function flipCards() {
	var url = '/game/' + getId() + '/story/' + gameInfo.current_story,
		//sp = $('#score').val(),
		data = {
				flipped: true,
			};
	//console.log(gameInfo());
	$.ajax({
		url: url,
		type: 'PUT',
		data: data,
		success: function( data, textStatus, jqXHR ) {
			stories[currentStoryNo].flipped = true;
			stories[data.ticket_no]=data;
			console.log('flipCards: ', data);
		},
		error: function( jqXHR, textStatus, errorThrown ) {
			console.log('ERROR: ', errorThrown);
		}
	});
}

//todo the story you clicked in the sidebar
function storyClickHandler(clickEvent){
	var story = clickEvent.data;
	console.log('click data', story);
	var url = '/game/'+getId() + '/goto-story/'+story.ticket_no;
	$.ajax({
		url: url,
		type: 'POST',
		/*success: function(data,textStatus,somethingElse){
			//pusher will be called, but it's kinda slow
			currentStoryNo = story.ticket_no;
			refreshDisplayedStory();
		}*/

	});//TODO: error handling
}
function joinGame(callback) {
	var self = $(this),
		url = '/game/' + getId() + '/participants'
	$.ajax({
		url: url,
		method: 'POST',
		success: function() {
			if (callback != undefined) {
				callback();
			}
		}
	});	
}

/*================================
	Utility functions
=================================*/
function refreshAll() {
	//console.log('update');
	//console.log(stories);
	/*if (stories.length == 0) {
		return;
	}*/

	refreshStoryList();
	refreshDisplayedStory(refreshParticipants);

	var storyLoaded = currentStoryNo != null;
	//hide things you can't do w/o a story
	$('#my-cards,#header').toggle(storyLoaded);
	$('#set-score-form .btn').toggleClass('disabled', !storyLoaded);
	$('#flip-btn').toggleClass('disabled', !(storyLoaded && !stories[currentStoryNo].flipped));

	$('#ticket').val("");
	$('#score').val("");
	$('#game').val("");
	document.title = "Game - "+ gameInfo.name;

	
}
var lastStory;
function refreshDisplayedStory(callback){
	//Generate ticket info
	$('#title').empty();
	$('#description').empty();
	var storyLoaded = currentStoryNo != undefined && currentStoryNo != null;
	
	var title,
		description;
	
	if (storyLoaded) {
		title = '<a href="https://request.siteworx.com/browse/' + stories[currentStoryNo].ticket_no 
			    + '" target="_blank">';
		title += stories[currentStoryNo].ticket_no;
		if (stories[currentStoryNo].summary!= null)
			title+= " - " + stories[currentStoryNo].summary;
		description = "";
		title += "</a>";
		console.log('currentStory - update', stories[currentStoryNo]);
		if (stories[currentStoryNo].description != null) { //always was true anyways
			description = stories[currentStoryNo].description.split('\n').join('<br />');
			description = description.split('\t').join('');
			description = description.split('\r').join('');
		}
	} else {
		description = '';
		title = 'No story loaded';
	}
	$('#title').html(title);
	$('#description').html(description);

	if (lastStory != currentStoryNo || (storyLoaded && stories[currentStoryNo].estimates.length == 0))
		$('#result-cards').empty();
	refreshEstimates();
	lastStory = currentStoryNo;
	callback();

}
function refreshEstimates(){
	//TODO: eliminate this total refresh and animate new ones in nicely
	if (currentStoryNo == null)
		return;
	// Generate result cards
	//$('#result-cards').empty();
	for (var i = 0; i < stories[currentStoryNo].estimates.length; i++) {
		estimate = stories[currentStoryNo].estimates[i];
		console.log("estimate");
		console.log(estimate);
		/*var resultCard = "<div id='" + i + "'class='result-card' data-original-title='" 
			+ estimate.user.fullname + "'>";
		console.log(stories[currentStoryNo].flipped);
		if (stories[currentStoryNo].flipped) {
			resultCard += estimate.user.fullname;
		}
		resultCard += "</div>";
		$('#result-cards').append(resultCard);
		var id = '#' + i;
		$(id).tooltip();
		*/
		appendEstimate(estimate);
	}
}
//show new estimate OR update vote on existing one
function appendEstimate(estimate){
	var id = "card-"+estimate.user.username,
		card = document.getElementById(id);

	if (card == undefined){
		card = document.createElement('div');
		card.id = id;
		var nameOnCard = document.createElement('span')
		nameOnCard.appendChild(document.createTextNode(estimate.user.fullname));
		nameOnCard.style.display = 'none';
		card.appendChild(nameOnCard);
		var vote = document.createElement('h1');
		vote.className = 'vote';
		card.appendChild(vote);
		card.className = 'result-card';
		card.setAttribute('data-original-title', estimate.user.fullname);
		if (estimate.vote != undefined){
			$(vote).empty().text(estimate.vote);
		}
		$(card).hide().appendTo('#result-cards').slideDown();
	} else { //update existing card
		var $vote = $('#'+id+' .vote');
		if ($vote.length && estimate.vote != undefined){
			$vote.empty().text(estimate.vote);
			$vote.fadeIn();
		} else {
			$vote.hide();
		}
	}
	$(card).tooltip();
}
//Generate stories on side bar
function refreshStoryList(){
	//$('#stories').empty();
	$('.side-tickets > li.active').removeClass('active');
	console.log('the stories are', stories);
	$.each(stories, function (ticket_no, story){
		console.log('showing a story list item', story);
		/*if(story.story_points == null) {
			story.story_points = 0;
		}

		var storyTitle = '<li>' + story.ticket_no + '&nbsp;&nbsp;:&nbsp;&nbsp;'
					   + story.story_points; + '</li>';
		$('#stories').append(storyTitle);
		*/
		appendStory(story);
	});

}
//append a story to the sidebar OR update one that's already there
function appendStory(story){
	var id = 'list-'+story.ticket_no;
	var li = document.getElementById(id);
	var $spSpan; //will be the jquery element for the story point span, created now or fetched
	if (li == undefined){
		var noText = document.createTextNode(story.ticket_no);
		var noSpan = document.createElement('span');
		noSpan.appendChild(noText);
		noSpan.className = "ticket-no";
		
		var spText = document.createTextNode(story.story_points);
		var spSpan = document.createElement('span');
		spSpan.className = "story-points";
		spSpan.appendChild(spText);
		
		var sepSpan = document.createElement('span');
		sepSpan.className = 'separator';
		sepSpan.innerHTML = "&nbsp;&nbsp;:&nbsp;&nbsp;";
		$(sepSpan).toggle(story.story_points >= 0);

		var li = document.createElement('li');
		li.id = "list-"+story.ticket_no;
		li.appendChild(noSpan);
		li.appendChild(sepSpan);
		li.appendChild(spSpan);

		$spSpan = $(spSpan);

		$(li).click(story, storyClickHandler);
		$(li).toggleClass('clickable', isAdmin);
		$('#stories').append(li);
		$(li).hide().slideDown();
	} else {
		$spSpan = $('#'+id+" .story-points");
		$spSpan.text(story.story_points);
		$('#'+id+' .separator').toggle(story.story_points >= 0);
	}

	$spSpan.toggle(story.story_points >= 0);

	//li.style.display = 'none';
	$(li).toggleClass('active', story.ticket_no == currentStoryNo);

}
function refreshParticipants(){
	for (var i=0;i<gameInfo.participants.length;i++)
		appendParticipant(gameInfo.participants[i]);
}
function appendParticipant(user){
	var id = 'participant-'+user.username;
	var li = document.getElementById(id);
	if (li==undefined){
		li = document.createElement('li');
		li.id=id;
		li.appendChild(document.createTextNode(user.fullname));
		$('#participants').append(li);
		$(li).hide().slideDown();
	}
}
function updateResultCards(){
}
function getUsername() {
	return getURLParameter('username');
}

function getId() {
	return getURLParameter('id');
}

function getURLParameter( name ) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null;
}
