$(document).ready(function() {
	getGames();
});

function getGames() {
	$.ajax({
		url: '/game',
		method: 'GET',
		success: function(data, textStatus, jqXHR) {
			update( data );
		},
		error: function(jqXHR, textStatus, errorThrown) {
			console.log('ERROR: ', errorThrown);
		}
	});	
}

function update( data ) {
	$('#games-body').empty();
	for (var i = 0; i < data.length; i++) {
		var game = data[i];
		var html = "<tr><td class='game'>" + game.name
			+ "</td><td class='games-button'><input type='button' "
			+ "class='btn btn-default' onclick='return login(this)' "
			+"value='Join Game' id='" + i + "' /></td></tr>"
		$('#games-body').append( html );
	};
}