'use strict'
import Game1Control from "./game1Control.js"
import Game from './game1Game.js'
import Vector from "./vector.js"
import { strictEqual } from "assert"

export default class Game1Testing extends Game1Control{
    constructor(io,users,lobbies,refreshRate){
        super(io,users,lobbies,refreshRate)
    }

    runTests(){
        // this.testRadiusMaking()
        // this.testPlayerSpawn()
        // this.testBallSpawn()
        // this.testSendingInfo()

        // this.testPlayerPushesBallHorizontally()
        // this.testPlayerPushesBallVerticallyOnTheRightSide()
        // this.testPlayerPushesBallIntoPlayerIntoWall()
    }

    // ESSENTIALS

    makeNewGame(){
        const lobby = {
            userIds: [],
            teams: ['orange','blue'],
            gameTimer: '1min',
            lobbyId: 'test'
        }
        const game = new Game(lobby,this.users)
        game.addGoals()
        return(game)
    }

    addUserAndPlayerToGame(game,team){
        const user = game.users.newUser(0,game)
        user.team = team
        game.userIds.push(user.userId)
        const player = this.addPlayerToGame(game,user.userId,team,0.5)
        return(player)
    }

    addPlayerToGame(game,userId,team,radius){
        game.players.addPlayer(userId,team,0,radius)
        if(!game.userIds.includes(userId)){
            game.userIds.push(userId)
        }
        return(game.players.getInfo(userId))
    }

    addBallToGame(game){
        game.addBall()
        return(game.ball)
    }

    logAllBallInfo(game){
        const ballIds = game.getAllBallIds()

        for(var ballId of ballIds){
            const ball = game.getObjectById(ballId)
            ball.logInfo()
        }
    }

    runTestGame(game,cycles,moveCommands){
        game.contacts = game.makeContacts()

        const p1 = game.players.getInfo('p1')

        for(var count = 0; count < cycles; count++){
            for(var moveCommand of moveCommands){
                p1[moveCommand] = 1
            }

            console.log('cycle %i before)',count)
            this.logAllBallInfo(game)

            game.updateGame()
            
            console.log('cycle %i after)',count)
            this.logAllBallInfo(game)
        }
    }

    // NOT INGAME

    testRadiusMaking(){
        const teamLength = 10
        console.log('makingPlayerRadius for %i players',teamLength)

        const game = this.makeNewGame()

        for(var count = 0; count < teamLength; count++){
            this.addUserAndPlayerToGame(game,'orange')
        }

        game.makePlayerRadius()
        console.log('radius', game.playerRadius)
        delete this.games[game.lobbyId]
    }

    testPlayerSpawn(){
        console.log('spawningPlayerTest')

        const game = this.makeNewGame()

        const p1 = this.addUserAndPlayerToGame(game,'orange')
        game.setPlayerSpawnPositions()

        // console.log('p1 startPosition', p1.startPosition, 'p1 actual position', p1.position)
        p1.setPosition(9,4)
        // console.log('p1 startPosition', p1.startPosition, 'p1 actual position', p1.position)
        game.resetBallPositions()
        // console.log('p1 startPosition', p1.startPosition, 'p1 actual position', p1.position)
        strictEqual(p1.startPosition.x, p1.position.x)
        delete this.games[game.lobbyId]
    }

    testBallSpawn(){
        const game = this.makeNewGame()
        this.addBallToGame(game)

        game.ball.setPosition(9,4)
        game.resetBallPositions()
        strictEqual(game.ball.startPosition.x, game.ball.position.x)
        delete this.games[game.lobbyId]
    }

    testSendingInfo(){
        console.log('makingGoalInfo')
        const game = this.makeNewGame()
        
        game.addBall()
        const ballInfo = game.ball.getSendingInfo()
        // console.log('ballInfo', ballInfo)
        
        const goalInfo = game.goals.getGoalSendingInfo()
        // console.log('goalInfo',goalInfo)

        const player = this.addUserAndPlayerToGame(game,'orange')
        const playerInfo = player.getSendingInfo()
        // console.log('playerInfo',playerInfo)

        console.log(game.getAllInfo())
    }

    // INGAME TESTS

    testPlayerPushesBallHorizontally(){
        console.log('pushingBallHorizontally')
        const game = this.makeNewGame()
        const player = this.addPlayerToGame(game,'p1','orange',0.5)
        player.setPosition(5,4)

        const ball = this.addBallToGame(game)
        ball.setPosition(player.position.x + 0.8, player.position.y)

        const moveCommands = ['moveR']
        const cycles = 1
        this.runTestGame(game,cycles,moveCommands)

        if( player.bounce.x > 0 || Math.abs(player.bounce.x) > Math.abs(ball.bounce.x)){
            strictEqual(0,1)
        }
        delete this.games[game.lobbyId]
    }

    testPlayerPushesBallVerticallyOnTheRightSide(){
        console.log('pushingBallUpToTheSide')
        const game = this.makeNewGame()
        const player = this.addPlayerToGame(game,'p1','orange',0.5)
        player.setPosition(5,4)

        const ball = this.addBallToGame(game)
        ball.setPosition(player.position.x - 0.2, player.position.y - 0.8)
        ball.addBounce(new Vector(0,-10))

        const moveCommands = ['moveU']
        const cycles = 5
        this.runTestGame(game,cycles,moveCommands)

        if( player.bounce.x < 0 || Math.abs(player.bounce.x) > Math.abs(ball.bounce.x)){
            strictEqual(0,1)
        }
        delete this.games[game.lobbyId]
    }
    
    testPlayerPushesBallIntoPlayerIntoWall(){
        //TODO: study chain collisions in cycle 2
        console.log('pushingBallUpToTheSide')
        const game = this.makeNewGame()

        const player1 = this.addPlayerToGame(game,'p1','orange',0.5880599999999999)
        player1.setPosition(1.8611779188665563,5.112191504427785)
        player1.addBounce(new Vector(0,0))

        const player2 = this.addPlayerToGame(game,'p2','orange',0.5880599999999999)
        player2.setPosition(0.8965639366266409,4.4393036091084745)
        player2.addBounce(new Vector(-11.973286158636686,-8.647400296412947))

        const ball = this.addBallToGame(game)
        ball.setPosition(14,6)
        ball.addBounce(new Vector(0,0))

        const moveCommands = ['moveU','moveL']
        const cycles = 5
        this.runTestGame(game,cycles,moveCommands)

        // if( player.bounce.x > 0 || Math.abs(player.bounce.x) > Math.abs(ball.bounce.x)){
        //     strictEqual(0,1)
        // }

        delete this.games[game.lobbyId]
    }
}