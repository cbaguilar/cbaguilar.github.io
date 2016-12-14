/**
 * 
 */
var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update });

function preload() {

	game.load.image('fish','ass/20160122_124114.jpg');
	game.load.image('ground','ass/20160122_124114.jpg');

	cursors = game.input.keyboard.createCursorKeys();
}
var mack;
var platforms;
function create() {
	
	mack = game.add.sprite(0,0,'mac');
	
	
	//mack.animations.play('walk',12,true);
	game.physics.startSystem(Phaser.Physics.ARCADE);
	game.physics.arcade.enable(mack);
	
	mack.body.bounce.y = 0.2;
	mack.body.gravity.y = 300
	mack.body.collideWorldBounds = true;
	
	platforms = game.add.group();
	platforms.enableBody = true;
	var ground = platforms.create(0, game.world.height - 64, 'ground');
	ground.scale.setTo(2,2);
	ground.body.immovable = true;
	var ledge = platforms.create(400,400,'ground');
	ledge.body.immovable = true;
	ledge = platforms.create(-150, 250, 'ground');
	ledge.body.immovable = true;
	var block = platforms.create(10,10, 'ground');
	block.body.immovable = true;
	block.scale.setTo(1,1);

	
	
}

function update() {

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
