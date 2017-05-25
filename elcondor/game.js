/**
 * 
 */
var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update });

function preload() {


	
	cursors = game.input.keyboard.createCursorKeys();
}
var connor;
var platforms;
var music;
var text;
var load = false;
var melo;
function create() {
	
	game.load.onLoadStart.add(loadStart, this);
	game.load.onFileComplete.add(fileComplete, this);
	game.load.onLoadComplete.add(loadComplete, this);
	
	text = game.add.text(100,100,'Welcome',{fill: '#ffffff'});
	text.setText("started");
	start();
	


	
}

function start(){
	text.setText("starting to load");
	game.load.audio('tunak', 'ass/tunaksmall.ogg');
	game.load.image('melo','ass/melo.png');
	game.load.image('condor','ass/condormicro.png')
	game.load.image('frank','ass/frank.jpg');
	game.load.image('ground','ass/melo.png');
	game.load.image('shrek','ass/shreks.png');
	game.load.image('grass','ass/grass.png');

	game.load.start();
}

function loadStart(){
	text.setText("loading..")
}

function fileComplete(){
	text.setText("file complete");

}

function loadComplete() {
	load = true;
	text.setText("Load COmplete");
	music = game.add.audio('tunak');
	music.play();
	
	
	connor = game.add.sprite(0,0,'condor');
	
	frank = game.add.sprite(200,50,'frank');

	
	
	//connor.animations.play('walk',12,true);
	game.physics.startSystem(Phaser.Physics.ARCADE);
	game.physics.arcade.enable(connor);
	
	connor.body.bounce.y = 0.2;
	connor.body.gravity.y = 300
	connor.body.collideWorldBounds = true;
	
	melo = game.add.sprite(100,100,'ground'); 
	melo.scale.setTo(0.5,0.5);
	melo.alpha = 0.01;

	frank.alpha = 0.01;
	
	platforms = game.add.group();
	platforms.enableBody = true;
	var grass = platforms.create(0, game.world.height - 64, 'grass');
	grass.body.immovable = true;
}

var faded = 0;

function fadeOut(order){
	console.log("tweening"+ order);
	switch (order){	
	case 1:
		game.add.tween(melo).to( {alpha:0}, 3000, Phaser.Easing.Linear.None, true);
		game.add.tween(frank).to( {alpha:0.9}, 2000, Phaser.Easing.Linear.None, true);
		window.setTimeout(function(){fadeOut(2);},4000);
	case 2:	
		//await sleep(1000);
		game.add.tween(frank).to( {alpha:0.5}, 5000, Phaser.Easing.Linear.None, true);
		window.setTimeout(function(){fadeOut(3);},4000);
	case 3:
		game.add.tween(frank).to( {alpha:0.1}, 5000, Phaser.Easing.Linear.None, true);
	}
}

function fadeIn(){
	game.add.tween(melo).to( {alpha:0.9}, 2000, Phaser.Easing.Linear.None, true);
	//fadeOut();
	console.log("trying to tween");
	window.setTimeout(function(){fadeOut(1);},7000);
	//game.time.events.add(Phaser.Timer.SECOND*10,fadeOut, this);
}

function Enemy(type){
	this.X = 100;
	this.Y = 100;
	this.type = type;
	this.hostile = "true";
	this.update = function() {
		X++;
		Y++;

	}
	this.getx = function() {
		return this.X;
	}
	this.gety = function() {
		return this.Y;
	}

}
var finished = 0;

function update() {

	
	text.setText(load);
	if(load && this.cache.isSoundDecoded('tunak')){
	if(finished == 0){
		connor.y = 100;
		finished = 1;
	}
	melo.visible=true;
	
	if (faded == 0){
	game.time.events.add(Phaser.Timer.SECOND*2,fadeIn, this);
	faded = 1;
	}

	
	if (cursors.left.isDown){
	connor.body.velocity.x = -90;
	//hohho
	}
	
	if (cursors.right.isDown){
	connor.body.velocity.x = 90;
	
	}
	if (!(cursors.right.isDown || cursors.left.isDown)){
	connor.body.velocity.x = 0;
	}
	if (cursors.up.isDown&& game.physics.arcade.collide(platforms,connor)){
	connor.body.velocity.y = 2000;
	}
	game.physics.arcade.collide(platforms,connor);

	}

}
