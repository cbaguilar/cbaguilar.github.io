/**
 * 
 */
var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update });


var characters = ['bird', 'frank', 'shrek', 'badcon', 'stanley']; // Names of character sprites
var selectedCharacter;
var characterSprites = [];
var selector; // A sprite for the selector arrow
var selectionIndex = 0; // Index of the currently selected character


function preload() {

    game.load.image('melo','ass/melo.png');
	game.load.image('condor','ass/condormicro.png')
	game.load.image('frank','ass/minifrank.png');
	game.load.image('ground','ass/melo.png');

	game.load.image('grass','ass/grass.png');
	//game.load.image('juice','ass/juice.png');

	game.load.image('badcon','ass/ryland.png');
	game.load.image('shrek','ass/noah.png');
	game.load.image('bird','ass/pat.png');

	game.load.image('juice','ass/sjuice.png');

	game.load.image('over','ass/over.png');
	game.load.image('stanley', 'ass/stanley.png')
	
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

	characters.forEach(function(name, index) {
        var sprite = game.add.sprite(100 + index * 200, 300, name);
        sprite.anchor.setTo(0.5, 0.5);
        characterSprites.push(sprite);
    });
    selector = game.add.sprite(100, 300, 'selector');
    selector.anchor.setTo(0.5, 1.5);

    var enterKey = game.input.keyboard.addKey(Phaser.Keyboard.ENTER);
    enterKey.onDown.add(startGame, this);

    cursors = game.input.keyboard.createCursorKeys();
    cursors.right.onDown.add(moveRight, this);
    cursors.left.onDown.add(moveLeft, this);

}

function moveRight() {
    selectionIndex = (selectionIndex + 1) % characters.length;
    selector.x = 100 + selectionIndex * 200;
}

function moveLeft() {
    selectionIndex = (selectionIndex + characters.length - 1) % characters.length;
    selector.x = 100 + selectionIndex * 200;
}

function startGame() {
    selectedCharacter = characters[selectionIndex];
	//destroy charater selection screen

	characterSprites.forEach(function(sprite) {
		sprite.visible = false;

		sprite.destroy();
	});
	selector.visible = false;
	//game.state.

	start();
    //game.state.start('mainGame');
}




function start(){
	text.setText("starting to load");
	
	
	fireButton = game.input.keyboard.addKey(Phaser.Keyboard.A);

	game.load.start();

}
var score = 0;
var gameover = false;
var monIMGS = ["shrek",'badcon','frank', 'bird','stanley'];

function loadStart(){
	text.setText("loading..")
}

function fileComplete(){
	text.setText("file complete");

}

function loadComplete() {
	load = true;
	text.setText("Load Complete");

	
	
	connor = game.add.sprite(0,0,selectedCharacter);

	
	frank = game.add.sprite(300,150,'frank');
	
	shrek = game.add.sprite(400,400,'shrek');
	shrek.alpha = 0.01;
	shrek.scale.setTo(0.01,0.01);
	
	over = game.add.sprite(0,0,'over');
	over.visible = false;

	
	//connor.animations.play('walk',12,true);
	game.physics.startSystem(Phaser.Physics.ARCADE);
	game.physics.arcade.enable(connor);
	
	connor.body.bounce.y = 0.2;
	connor.body.gravity.y = 300
	connor.body.collideWorldBounds = true;
	connor.visible = false;
	
	melo = game.add.sprite(100,100,'ground'); 
	melo.scale.setTo(0.5,0.5);
	melo.alpha = 0.01;

	frank.alpha = 0.01;
	
	platforms = game.add.group();
	platforms.enableBody = true;
	var grass = platforms.create(0, game.world.height - 64, 'grass');
	grass.body.immovable = true;

	monsters = game.add.group();
	monsters.enableBody = true;

	bullets = game.add.group();
	bullets.enableBody = true;



}

var faded = 0;
var monstersCreated = false;

function createBullet(){

	var bullet = bullets.create(connor.x,connor.y-3,"juice");
	bullet.anchor.setTo(0.5,0.5);

            bullet.body.velocity.y = -400;
}

function createMonsters(){

	for (var y = 0; y < 2; y++)
	{
		for (var x = 1; x < 9; x++)
		{
			print
			if (difficulty / 1000 < Math.random()){
				continue;
			}
			var monster = monsters.create(x*90, y*60,monIMGS[Math.floor(Math.random()*monIMGS.length)]);
			monster.anchor.setTo(0.5,0.5);
			monster.body.velocity.y= Math.random()*50;
		}
	}

	monstersCreated = true;

}

function descend() {
	//monsters.y += .5;
	monsters.x += 2*(Math.random()-0.5)
}








function showCon(){
	connor.visible = true;
}

function moveCon(){
	connor.y=200;
}
function fshrek(){
	game.add.tween(shrek).to( {alpha:0.9}, 5000, Phaser.Easing.Linear.None, true);
}

var finished = 0;
var cooldown = 100;

var difficulty = 0;

function collisionHandler (bullet, alien) {

    //  When a bullet hits an alien we kill them both
    bullet.kill();
    alien.kill();

    //  Increase the score
    score += 20;
    text.setText(score);
}

function gameOver (floor, alien) {

    //  When a bullet hits an alien we kill them both
    alien.kill();

    //  Increase the score
	over.visible = true;
	gameover = true;
}





var timer = 0;
function update() {

		
	
	if(load &&gameover == false){
		if(monstersCreated){
			
			if (timer > 1000-difficulty){
			timer = 0;
			difficulty +=10;
			createMonsters();
			}
	
			descend();
		}
		else{
			if (cursors.down.isDown){
				createMonsters();
				moveCon();
			}
		}
	if(finished == 0){
		connor.y = 100;
		finished = 1;
	}
	melo.visible=true;
	
	if (faded == 0){
	game.time.events.add(Phaser.Timer.SECOND*2,showCon, this);
	game.time.events.add(Phaser.Timer.SECOND*2,moveCon, this);
	game.time.events.add(Phaser.Timer.SECOND*3,createMonsters, this);


	faded = 1;
	}
	
	
		
	if (fireButton.isDown && cooldown < 0){
		console.log("shoot")
		createBullet();
		cooldown = 20;
	}
	cooldown--;

	
	if (cursors.left.isDown||(game.input.pointer1.isDown)){
	connor.body.velocity.x = -170;
	//createMonsters();
	//hohho
	}
	
	if (cursors.right.isDown){
	connor.body.velocity.x = 170;
	
	}
	if (!(cursors.right.isDown || cursors.left.isDown)){
	connor.body.velocity.x = 0;
	}
	if (cursors.up.isDown&& game.physics.arcade.collide(platforms,connor)){
	connor.body.velocity.y = 2000;
	}
	game.physics.arcade.collide(platforms,connor);

	game.physics.arcade.overlap(bullets, monsters,collisionHandler,null,this);
	game.physics.arcade.overlap(monsters, platforms, gameOver, null, this);
	
	timer ++;
	}

}
