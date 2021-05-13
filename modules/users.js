'use strict'
class User{
    constructor(userId,socket,lobbyId,userName){
        this.userId = userId
        this.socket = socket
        this.lobbyId = lobbyId
        this.userName = userName
        this.ready = 0
        this.team = 0

        this.inGame = 0
    }
}

export default class UserManager{
    constructor (){
        this.users = {},
        this.idLength = 10
    }

    doesUserExist(userId){
        if(Object.keys(this.users).includes(userId)){
            return(1)
        }
    }

    getAllInfo(){
        return(this.users)
    }

    getInfo(userId){
        return(this.users[userId])
    }

    changeName(userIds,userId,userName){
        var userNames = this.getNames(userIds)
        if(!userNames.includes(userName)){
            this.users[userId].userName = userName
            return(1)
        }
    }
    
    getNames(userIds){
        var userNames = []
        for(var userId of userIds){
            userNames.push(this.users[userId].userName)
        }
        return(userNames)
    }

    makeName(userIds){
        var userNames = this.getNames(userIds)
        while(true){
            var userName = 'player' + Math.floor(Math.random()*999)
            if(!userNames.includes(userName)){
                return(userName)
            }
        }
    }

    makeId(){
        const hex = 'ghijklmnopqrstuvxyz'
        var userId = ''
        while (true){
            for (var a=0; a<this.idLength; a++){
                userId += hex[Math.floor(Math.random()*16)]
            }
            if (!Object.keys(this.users).includes(userId)){
                return(userId)
            }
        }
    }

    newUser(socket,lobby){
        const userId = this.makeId()
        const userName = this.makeName(lobby.userIds)
        this.users[userId] = new User(userId,socket,lobby.lobbyId,userName)
        return(this.users[userId])
    }

    deleteUser(user){
        delete this.users[user.userId]
    }
}
