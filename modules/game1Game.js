'use strict'

import PlayerManager from './game1PlayerManager.js'
import PhysicsManager from './game1Physics.js'
import Ball from './game1Ball.js'
import Goals from './game1Goal.js'
import { strictEqual } from 'assert'

const MINUTES_TO_SECONDS = 60
const ROUNDING_ERROR = 0.001
const MILISECONDS_TO_SECONDS = 1/1000

export default class Game{
    constructor(lobby,users){
        this.serverH = 9
        this.serverW = 16
        
        this.users = users
        this.players = new PlayerManager()
        this.physics = new PhysicsManager(this.serverW,this.serverH,this.players)

        this.userIds = lobby.userIds
        this.contacts = this.makeContacts()
        this.teams = lobby.teams
        this.lobbyId = lobby.lobbyId

        this.playerRadius = null

        // in seconds
        this.gameTime = 0
        //[0] is X from "Xmin"
        this.gameTimer = Number(lobby.gameTimer[0])*MINUTES_TO_SECONDS 
        this.countdown = 1
        
        // in miliseconds
        this.lastTime = Date.now()
        this.timeDiff = 0

        this.inGame = 1
        this.ball = null
        this.goals = null
        
        this.scorerListLength = 5
        this.scorerTextDelimeter = '!'

        this.spawnRadius = 4
        this.maxPlayerRadius = 0.6
        this.maxPlayerRadiusDecay = 0.99

        this.gameCountdown = 1
        this.impulseCooldown = 1
        this.refreshRate = 100

        this.timePassed = 0 
        this.collisionProcedureRepeats = 0
    }

    getObjectById(objectId){
        let object
        if(objectId == 'ball'){
            object = this.ball
        }
        else{
            object = this.players.getInfo(objectId)
        }
        return(object)
    }

    getAllBallIds(){
        var objects = this.userIds.slice()
        if(this.ball){
            objects.push('ball')
        }
        return(objects)
    }

    //TEXT

    makeEndInfo(){
        const info = {}
        info['summary'] = this.makeWinnerTeamText()
        info['scorers'] = this.makeScorerText()
        return(info)
    }

    makeWinnerTeamText(){
        var text = ''
        const goals = this.goals.getGoals()
        const orangeGoals = goals['orange'].goalsScored
        const blueGoals = goals['blue'].goalsScored

        if(blueGoals > orangeGoals){
            text = 'blue team has won (' + blueGoals + '-' + orangeGoals +')'
        }
        else if(orangeGoals > blueGoals){
            text = 'orange team has won (' + orangeGoals + '-' + blueGoals +')'
        }
        else{
            text = 'both teams tied (' + orangeGoals + '-' + blueGoals +')'
        }

        return(text)
    }

    getScorersOrdered(){
        var scorers = []
        for(var userId of this.userIds){
            const player = this.players.getInfo(userId)
            if(player.goals){
                scorers.push(player)
            }
        }
        scorers.sort( (a,b) => b.goals - a.goals)
        return(scorers)
    }

    getScorerText(scorers){
        var text = ['/','black','top scorers:','!']

        for(var count = 0;
            count < Math.min(scorers.length,this.scorerListLength);
            count++)
        {
            const scorer = scorers[count]
            text.push('/', scorer.team, scorer.userName, ': ',
                scorer.goals, '!')
        }

        if(scorers.length == 0){
            text.push('/','black','absolutely nobody', '!')
        }
        else if(scorers.length > 6){
            text.push('/', 'black', '...', '!')
        }
        return(text)
    }

    makeScorerText(){
        const scorers = this.getScorersOrdered()
        const text = this.getScorerText(scorers)
        return(text)
    }

    // SETUP GAME

    makeContacts(){
        const count = this.userIds.length
        var contacts = []
        for(var i=0; i<count; i++){
            var ballContact = [this.userIds[i],'ball']
            contacts.push(ballContact)

            for(var p = i+1; p<count; p++){
                var contact = [this.userIds[i],this.userIds[p]]
                contacts.push(contact)
            }
        }
        return(contacts)
    }

    addBall(){
        const x = this.serverW/2
        const y = this.serverH/2
        this.ball = new Ball(x,y)
        this.ball.setStartPosition(x,y)
    }

    makePlayerRadius(){
        const teamCounts = this.countTeamMembers()
        const biggestTeamCount = Math.max(...Object.values(teamCounts))
        const angleInterval = Math.PI/(biggestTeamCount+1)
        var radius = this.maxPlayerRadius*this.maxPlayerRadiusDecay**this.userIds.length

        while(1){
            const p1 = this.makePosition(0)
            const p2 = this.makePosition(angleInterval)
            const distance = this.physics.getDistanceBetweenTwoPoints(p1,p2)
            if( distance > 4*radius + ROUNDING_ERROR){
                break
            }
            radius *= 0.95
        }
        this.playerRadius = radius
    }

    countTeamMembers(){
        var memberCounts = {'orange':0 , 'blue':0}
        for(var userId of this.userIds){
            const user = this.users.getInfo(userId)
            if(user.team == 'orange'){
                memberCounts['orange'] += 1
            }
            else{
                memberCounts['blue'] += 1
            }
        }
        return(memberCounts)
    }

    makePosition(angle){
        return{
            'x': Math.cos(angle) * this.spawnRadius + this.serverW/2,
            'y': Math.sin(angle) * this.spawnRadius + this.serverH/2
        }
    }

    addPlayers(){
        for(var userId of this.userIds){
            const user = this.users.getInfo(userId)
            this.players.addPlayer(
                userId,
                user.team,
                user.userName,
                this.playerRadius
            )
        }
        this.setPlayerSpawnPositions()
    }

    setPlayerSpawnPositions(){
        const angleInfo = this.getTeamAngleInfo()

        for(var playerId of this.userIds){
            const player = this.players.getInfo(playerId)
            this.setPlayerStartPosition(player,angleInfo)
        }
    }

    getTeamAngleInfo(){
        const teamCounts = this.countTeamMembers()
        const orangeAngleInterval = Math.PI/(teamCounts['orange']+1)
        const blueAngleInterval = Math.PI/(teamCounts['blue']+1)
        
        return({
            'orangeAngleInterval': orangeAngleInterval,
            'orangeAngle': Math.PI/2 + orangeAngleInterval,
            'blueAngleInterval': blueAngleInterval,
            'blueAngle': -Math.PI/2 + blueAngleInterval,
        })
    }

    setPlayerStartPosition(player,angleInfo){
        let position
        if(player.team == 'blue'){
            position = this.makePosition(angleInfo.blueAngle)
            angleInfo.blueAngle += angleInfo.blueAngleInterval
        }
        else if(player.team == 'orange'){
            position = this.makePosition(angleInfo.orangeAngle)
            angleInfo.orangeAngle += angleInfo.orangeAngleInterval
        }

        player.setStartPosition(position.x,position.y)
    }

    addGoals(){
        this.goals = new Goals()
        const goals = this.goals

        goals.addGoal('left', 'orange')
        goals.addGoal('right', 'blue')
    }

    // GAME EVENTS

    endGame(){
        this.inGame = 0
    }

    getAllSendingInfo(){
        const playerInfo = this.players.getAllPlayerSendingInfo()
        const ballInfo = this.ball.getSendingInfo()
        const goalInfo = this.goals.getGoalSendingInfo()

        const timer = Math.ceil(this.countdown)
        const timeLeft = Math.ceil(this.gameTimer - this.gameTime)

        return({
            'players':playerInfo,
            'ball':ballInfo,
            'goal':goalInfo,
            'countdown': timer,
            'timeLeft': timeLeft,
            'impulseColor': ''
        })
    }

    sendGame(allInfo){
        for(var userId of this.userIds){
            const user = this.users.getInfo(userId)
            const socket = user.socket
            allInfo['impulseColor'] = this.getImpulseColor(user)

            socket.emit('game1Update',allInfo)
        }
    }

    getImpulseColor(user){
        const player = this.players.getInfo(user.userId)
        if(player.impulseCooldown){
            return('red')
        }
        return('green')
    }

    recordPlayerImpulse(userId){
        const player = this.players.getInfo(userId)

        if(this.countdown || player.impulseCooldown){
            return
        }
        player.activateImpulse(this.impulseCooldown)
    }

    recordPlayerMove(userId,move){
        const player = this.players.getInfo(userId)
        player.commands.recordMoveCommands(move)
    }

    // UPDATE GAME

    updateGameTime(){
        const now = Date.now()
        const timeDiff = now - this.lastTime

        this.timeDiff = timeDiff
        this.countdown -= timeDiff * MILISECONDS_TO_SECONDS

        if(this.countdown < 0){
            this.countdown = 0
            this.gameTime += timeDiff * MILISECONDS_TO_SECONDS
        }

        this.lastTime = Date.now()
    }

    updateGame(){
        this.impulseControl()
        this.limitObjectSpeeds()
        this.calculateBallMotion()
        this.collisionProcedure()
        this.resetAllMoves()   
        this.applyFriction()
    }

    impulseControl(){
        const timeDiff = this.timeDiff * MILISECONDS_TO_SECONDS

        for(var playerId of this.userIds){
            const player = this.players.getInfo(playerId)

            if(player.newImpulse){
                this.impulsePlayer(player)
                player.deactivateImpulse()
            }

            player.decreaseImpulseCooldown(timeDiff)
        }
    }

    impulsePlayer(player){
        this.physics.impulseOffWall(player)
        this.giveBallsBounceFromImpulse(player)
    }

    giveBallsBounceFromImpulse(player){
        const ballIds = this.getAllBallIds()

        for(var targetId of ballIds){
            if(targetId == player.userId){
                continue
            }
            const target = this.getObjectById(targetId)

            if(this.physics.isWithinImpulseRange(player,target)){
                this.physics.giveTargetBounce(player,target)
            }
        }
    }

    limitObjectSpeeds(){
        const ballIds = this.getAllBallIds()
        
        for(var ballId of ballIds){
            const ball = this.getObjectById(ballId)
            if(ball.isBounceTooFast()){
                ball.limitBounceSpeed()
            }
        }
    }

    calculateBallMotion(){
        for(var playerId of this.userIds){
            const player = this.players.getInfo(playerId)
            player.commands.deleteMoveContradictions()
            player.setMoveSpeed()
            player.makeMotionVector()
        }

        const ball = this.ball
        if(ball){
            ball.makeMotionVector()
        }
    }

    resetAllMoves(){
        for(var playerId of this.userIds){
            const player = this.players.getInfo(playerId)
            player.commands.resetPlayerMoveCommands()
            player.resetMotion()
        }
        const ball = this.ball
        if(ball){
            ball.resetMotion()
        }
    }

    applyFriction(){
        const ballIds = this.getAllBallIds()
        
        for(var ballId of ballIds){
            const ball = this.getObjectById(ballId)
            ball.resolveFriction()
        }
    }

    isGoal(){
        const ball = this.ball
        const goals = this.goals.getGoals()

        // ball hits wall between top and bottom edge of goal
        if( (ball.position.x == ball.radius) &&
            (ball.position.y > goals['orange'].position.y) &&
            (ball.position.y < goals['orange'].position.y + goals['orange'].height) )
        {
            this.countGoal('blue')
        }
        if( (ball.position.x == this.serverW-ball.radius) &&
            (ball.position.y > goals['blue'].position.y) && 
            (ball.position.y < goals['blue'].position.y + goals['blue'].height) )
        {
            this.countGoal('orange')
        }
    }

    countGoal(scoringTeam){
        const goal = this.goals.getGoals()[scoringTeam]
        goal.goalsScored += 1
        this.countdown = this.gameCountdown

        const scorer = this.players.getInfo(goal.lastBallToucher)
        if(scorer){
            scorer.goals += 1
        }
        this.resetBallPositions()
    }

    resetBallPositions(){
        const ballIds = this.getAllBallIds()
        for(var ballId of ballIds){
            const ball = this.getObjectById(ballId)
            ball.spawnAtStartPosition()
        }
        this.players.restartImpulseCooldowns()
    }

    // COLLISION PROCEDURE

    collisionProcedure(){
        const nextCollision = this.getNextCollision()
        const remainingTime = 1/this.refreshRate - this.timePassed
        // console.log(nextCollision)
        this.isOverlap()
        this.isBounceReasonable()

        if(!nextCollision || nextCollision.time > remainingTime){
            // console.log('noCollision')
            this.moveGameObjects(remainingTime)
            this.timePassed = 0
            this.collisionProcedureRepeats = 0
            return
        }
        this.collisionProcedureRepeats += 1
        this.timePassed += nextCollision.time
        
        // if(this.collisionProcedureRepeats > 100){
        //     console.log(nextCollision)
        //     console.log(this.players)
        //     console.log(this.ball)
        //     strictEqual(0,1)
        // }

        if (nextCollision.type == 'wall'){
            // console.log('wallCollision')
            this.wallCollisionProcedure(nextCollision)
        }
        else if(nextCollision.type == 'player'){
            // console.log('playerCollision')
            this.objectCollisionProcedure(nextCollision)
        }
        this.collisionProcedure()
    }

    getNextCollision(){
        const playerCollision = this.getNext2ObjectCollision()
        const wallCollision = this.getGameNextWallCollision()

        if(wallCollision &&
            (!playerCollision || wallCollision.time <= playerCollision.time) )
        {
            return(wallCollision)
        }

        else if(playerCollision &&
            (!wallCollision || playerCollision.time < wallCollision.time) )
        {
            return(playerCollision)
        }
    }

    getNext2ObjectCollision(){
        const contacts = this.contacts
        var nextCollision = null

        for(var count = 0; count < contacts.length; count++){
            const contact = contacts[count]
            const p1 = this.getObjectById(contact[0])
            const p2 = this.getObjectById(contact[1])
            const time = this.physics.getObjectCollisionTime(p1,p2)

            if(time >= 0 && (!nextCollision || time < nextCollision.time) ){
                nextCollision = {
                    'time': time,
                    'p1': p1,
                    'p2': p2,
                    'type': 'player'
                }
            }
        }
        return(nextCollision)
    }

    getGameNextWallCollision(){
        var ballIds = this.getAllBallIds()
        var nextCollision = null

        for(var objectId of ballIds){
            const object = this.getObjectById(objectId)
            const time = this.getPlayerNextWallCollisionTime(object)

            if(time >= 0 && (!nextCollision || time < nextCollision.time) ){
                nextCollision = {
                    'time': time,
                    'p1': object,
                    'type': 'wall'
                } 
            }
        }
        return(nextCollision)
    }

    getPlayerNextWallCollisionTime(p1){
        const upTime = this.physics.whenIsWallCollisionUp(p1)
        const downTime = this.physics.whenIsWallCollisionDown(p1)
        const leftTime = this.physics.whenIsWallCollisionLeft(p1)
        const rightTime = this.physics.whenIsWallCollisionRight(p1)
        
        var legitTimes = []
        for(var time of [upTime,downTime,leftTime,rightTime]){
            time = this.physics.roundSmallNegativeToZero(time)
            if(time >= 0){
                legitTimes.push(time)
            }
        }

        return(Math.min(...legitTimes))
    }

    moveGameObjects(time){
        const ballIds = this.getAllBallIds()
        
        for(var ballId of ballIds){
            const ball = this.getObjectById(ballId)
            ball.move(time)
            this.isGoal()
        }
    }

    wallCollisionProcedure(nextCollision){
        const time = nextCollision.time
        const object = nextCollision.p1

        this.moveGameObjects(time)
        object.changeTrajectoryFromWallCollision()
        object.resetMotion()
        object.makeMotionVector()
    }

    objectCollisionProcedure(nextCollision){
        const time = nextCollision.time
        const p1 = nextCollision.p1
        const p2 = nextCollision.p2

        if(!p2.userId && this.goals){
            const goal = this.goals.getGoals()[p1.team]
            goal.lastBallToucher = p1.userId
        }

        this.moveGameObjects(time)
        this.physics.changeObjectCollisionTrajectory(p1,p2)
        p1.resetMotion()
        p2.resetMotion()
        p1.makeMotionVector()
        p2.makeMotionVector()
    }

    isOverlap(){
        for(var contact of this.contacts){
            const p1 = this.getObjectById(contact[0])
            const p2 = this.getObjectById(contact[1])
            const distance = this.physics.getDistanceBetweenTwoPoints(p1.position,p2.position)

            if(distance < p1.radius + p2.radius - ROUNDING_ERROR){
                p1.dx = 100 //TEMPORARY FIX
                p2.dx = -100
                strictEqual(0,1)
            }
        }   
    }

    isBounceReasonable(){
        var objectIds = this.getAllBallIds()
        
        for(var objectId of objectIds){
            const object = this.getObjectById(objectId)
            const bounceMagnitude = object.getBounceMagnitude()

            if(bounceMagnitude > 500){
                console.log(object,this.ball)
                strictEqual(0,1)
            }
        }
    }
}