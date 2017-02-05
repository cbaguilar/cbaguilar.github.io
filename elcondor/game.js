/**
 * 
 */
var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update });

function preload() {


	
	cursors = game.input.keyboard.createCursorKeys();
}
var mack;
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
	game.load.image('ground','ass/melo.png');
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
	
	
	mack = game.add.sprite(0,0,'condor');

	
	
	//mack.animations.play('walk',12,true);
	game.physics.startSystem(Phaser.Physics.ARCADE);
	game.physics.arcade.enable(mack);
	
	mack.body.bounce.y = 0.2;
	mack.body.gravity.y = 300
	mack.body.collideWorldBounds = true;
	
	melo = game.add.sprite(100,100,'ground'); 
	melo.scale.setTo(0.5,0.5);
	melo.alpha = 0.01;
	
	platforms = game.add.group();
	platforms.enableBody = true;
}

function fadeOut(){
	game.add.tween(melo).to( {alpha:0}, 2000, Phaser.Easing.Linear.None, true);
}

function fadeIn(){
	game.add.tween(melo).to( {alpha:0.9}, 2000, Phaser.Easing.Linear.None, true);
	game.time.events.add(Phaser.Timer.SECOND*2,fadeOut, this);
}

function update() {
	text.setText(load);
	if(load && this.cache.isSoundDecoded('tunak')){
	melo.visible=true;
	game.time.events.add(Phaser.Timer.SECOND*2,fadeIn, this);
	

	
	if (cursors.left.isDown){
	mack.body.velocity.x = -90;
	//hohho
	}
	
	if (cursors.right.isDown){
	mack.body.velocity.x = 90;
	
	}
	if (!(cursors.right.isDown || cursors.left.isDown)){
	mack.body.velocity.x = 0;
	}
	if (cursors.up.isDown&& game.physics.arcade.collide(platforms,mack)){
	mack.body.velocity.y = 2000;
	}
	game.physics.arcade.collide(platforms,mack);

	}
}
