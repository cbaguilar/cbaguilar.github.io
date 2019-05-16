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

	game.load.image('grass','ass/grass.png');
	//game.load.image('juice','ass/juice.png');

	game.load.image('badcon','ass/condormm.png');
	game.load.image('shrek','ass/shreks.png');
	game.load.image('badf','ass/minifrank.png');
	game.load.image('bird','ass/smallb.png');

	game.load.image('juice','ass/sjuice.png');

	game.load.image('over','ass/over.png');
	
	fireButton = game.input.keyboard.addKey(Phaser.Keyboard.A);

	game.load.start();

}
var score = 0;
var gameover = false;
var monIMGS = ["shrek",'badcon', 'bird','badf'];

function loadStart(){
	text.setText("loading..")
}

function fileComplete(){
	text.setText("file complete");

}

function loadComplete() {
	load = true;
	text.setText("Load COmplete , press A to kill things\n - Russia <3");
	music = game.add.audio('tunak');
	music.play();
	
	
	connor = game.add.sprite(0,0,'condor');
	connor.scale.setTo(0.5,0.5);

	
	frank = game.add.sprite(300,150,'frank');
	
	shrek = game.add.sprite(400,400,'shrek');
	shrek.alpha = 0.01;
	
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

function fadeOut(order){
	console.log("tweening"+ order);
	switch (order){	
	case 1:
		game.add.tween(melo).to( {alpha:0}, 3000, Phaser.Easing.Linear.None, true);
		game.add.tween(frank).to( {alpha:0.9}, 2000, Phaser.Easing.Linear.None, true);
		window.setTimeout(function(){fadeOut(2);},4000);
	case 2:	
		//await sleep(1000);
		game.add.tween(frank).to( {alpha:0.9}, 5000, Phaser.Easing.Linear.None, true);
		window.setTimeout(function(){fadeOut(3);},4000);
	case 3:
		game.add.tween(frank).to( {alpha:0.4}, 5000, Phaser.Easing.Linear.None, true);
	case 5:
		game.add.tween(shrek).to( {alpha:0.9}, 5000, Phaser.Easing.Linear.None, true);
		
	}


}

function fadeIn(){
	game.add.tween(melo).to( {alpha:0.9}, 2000, Phaser.Easing.Linear.None, true);
	//fadeOut();
	console.log("trying to tween");
	window.setTimeout(function(){fadeOut(1);},7000);
	
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

		
	
	if(load && this.cache.isSoundDecoded('tunak')&&gameover == false){
		if(monstersCreated){
			
			if (timer > 300-difficulty){
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
	game.time.events.add(Phaser.Timer.SECOND*10,fshrek, this);
	game.time.events.add(Phaser.Timer.SECOND*2,fadeIn, this);
	game.time.events.add(Phaser.Timer.SECOND*10,showCon, this);
	game.time.events.add(Phaser.Timer.SECOND*28.5,moveCon, this);
	game.time.events.add(Phaser.Timer.SECOND*35,createMonsters, this);


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
