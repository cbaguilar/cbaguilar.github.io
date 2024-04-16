var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update });

var characters = ['connor', 'frank', 'shrek']; // Names of character sprites
var selectedCharacter;
var characterSprites = [];
var selector; // A sprite for the selector arrow
var selectionIndex = 0; // Index of the currently selected character

function preload() {
    game.load.image('selector', 'assets/selector.png'); // Load an arrow or any other selector image
    game.load.image('connor', 'assets/connor.png');
    game.load.image('frank', 'assets/frank.png');
    game.load.image('shrek', 'assets/shrek.png');
    game.load.image('ground', 'assets/ground.png');
    game.load.image('grass', 'assets/grass.png');
    game.input.keyboard.createCursorKeys();
}

function create() {
    game.stage.backgroundColor = '#182d3b';
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

function update() {
    // Character selection logic is handled in the create function and key listeners
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
    game.state.start('mainGame');
}

// You would then modify the rest of your game logic to fit within a 'mainGame' state,
// where you would use 'selectedCharacter' to control which character is active.
