const Eris = require("eris");
const { get } = require("express/lib/response");
const { Configuration, OpenAIApi } = require("openai");
require('dotenv').config()

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const bot = new Eris(process.env.DISCORD_BOT_TOKEN, {
    intents: ["guildMessages"]
});

const dmrole = "You are a dungeon master for a 3.5 Edition Dungeons and Dragon campaign. You run a campaign for me, the user. Progress the story and tell me what happens next in the story. For context the users character sheet and chatlog are provided. ALWAYS follow Note to Dungeon Master but never include them in your response or message. End your message by asking me what I will do next.";

const MAX_SIZE = 4

let previousMessages = [];

let characterSheet = "*Note to Dungeon Master, do not include in your message: Fully generate all parts of the user character sheet below on behalf of the user. Remove this note once completed by you, the Dungeon Master.*\n#START OF CHARACTER SHEET*\nTitle: User's Character Sheet\nName: \nRace: \nClass: \nLevel: \nBackground: \nAlignment: \nAbilities: \nStrength: 0\nDexterity: 0\nConstitution: 0\nIntelligence: 0\nWisdom: 0\nCharisma: 0\n\nSkills: ''\nArmorClass: 10\nHitPoints: 0\nEquipment: \nFeaturesAndTraits: \n*END OF CHARACTER SHEET#";

previousMessages.push("\nPlease help me set up my DnD character. Ask me for my character name and class and then fully generate my character sheet.");

async function getCompletion(message) {
    const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
            {role: "system", content: dmrole},
            {role: "user", content: message}
        ],
    });
    return completion.data.choices[0].message;
    }
async function factCompletion(message) {
    const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
            {role: "system", content: "You check the semantics of a message to determine if certains concepts were mentioned. You answer the question 'True' or 'False' and give your reasoning."},
            {role: "user", content: message}
        ],
    });
    return completion.data.choices[0].message;
    }
function shiftPreviousMessages(){
    if (previousMessages.length > MAX_SIZE){
        //console.log("Shifting previous messages..." + previousMessages.shift());
    }
}

bot.on("ready", () => {
    console.log("Ready to begin dungeon mastering!");
    bot.createMessage("1089428977388617759", "The Dungeon Master is now online! Please send me a message to begin the adventure!\nTip: You can ask me to show your character sheet at any time. Doing so snapshots all items.");
});

bot.on("error", (err) => {
    console.log(err);
});

bot.on("messageCreate", (msg) => {

    //Check if the message is from the Eris bot itself
    if (msg.author === bot.user) return;

    if (msg.channel.id === "1089428977388617759"){

        shiftPreviousMessages();
        previousMessages.push("\n" + msg.content);

        shiftPreviousMessages();
        getCompletion(characterSheet + "\n\nStory so far:\n" + previousMessages.toString()).then(result => {

            previousMessages.push("\n" + result.content.toString());

            bot.createMessage(msg.channel.id, result).then(message => {
                setCharacterSheet(message.content.toString())
                gotLoot(message);
                });
            });

            
    }
    else{
        console.log("Channel ID: " + msg.channel.id );
    }
});

async function gotLoot(msg){
    //console.log("Checking if the player received loot... " + msg.content.toString() + "\n")
    factCompletion("'True' or 'False': This following message specifically mentions any of the following: finding, looting, buying, selling, gaining, or losing any items such as gold, potions, weapons, or other useful items.:\nExample 1: The shopkeeper has an assortment of potions and trinkets for sale.\nResponse: False. The player has not bought anything.\n#\nExample 2: You give the shopkeeper the gold and he hands you a potion.\nResponse: True. The player has received a new item, a potion.\n#\nExample 3: Equipment: Wand, Potions, Leather Armor.\nResponse: False. This is just a list of the players existing equipment and character sheet.\n#\nExample 4: You encounter some...\nResponse: False. The player is combat and has not yet received any items.\n#\nBegin Message: " + msg.content.toString() + "\nResponse: ").then(result => {
  
        console.log("Loot response: " + result.content.toString());
        if (result.content.toString().includes("True") || result.content.toString().includes("true")){
            //console.log("The player received loot!");
            bot.createMessage(msg.channel.id, "**I think you may have found some loot so I will review the messages and update your character sheet if needed.**");
            getCompletion("Review the following messages and update my Character Sheet with any detailed items not present in the Existing Character Sheet.:\n" + "Loot response: " + result.content.toString() + "\nExisting Character Sheet:" + characterSheet + "Please pdate my full Character Sheet with any missing things:" + characterSheet.slice(0,10) + "...").then(result => {
                //previousMessages.push("\n" + result.content.toString());
                bot.createMessage(msg.channel.id, result).then(message => {
                    setCharacterSheet(message.content.toString())
                    });
                });
            return true;
        }
        else{
            //console.log("The player did not receive loot!");
            return false;
        }
        });
}

function setCharacterSheet(content){
    if (content.includes("Title:")){
        characterSheet = content;
        console.log("Character Sheet Updated!");
        return true;
    }
    return false;
}
bot.connect().then(() => {
    //console.log("Connected to Discord!");
});