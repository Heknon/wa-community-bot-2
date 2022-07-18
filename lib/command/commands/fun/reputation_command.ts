import {jidDecode, WASocket} from "@adiwajshing/baileys";
import url from "node:url";
import {Chat} from "../../../chats";
import {messagingService, userRepository} from "../../../constants/services";
import Message from "../../../message/message";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";
import {BlockedReason} from "../../../blockable";
import moment from "moment";
import {havePluralS} from "../../../utils/message_utils";

export default class ReputationCommand extends Command {
    constructor() {
        super({
            triggers: ["rep", "reputation", "כבוד"].map((e) => new CommandTrigger(e)),
            usage: "{prefix}{command} @mention",
            category: "Fun",
            description: "Give someone reputation for being such a good person!",
        });
    }

    async execute(client: WASocket, chat: Chat, message: Message, body?: string) {
        if (!message.sender) {
            return await messagingService.reply(message, "An error occurred while processing this message.", true);
        }

        const givingUser = await userRepository.get(message.sender);
        if (!givingUser) {
            return await messagingService.reply(message, "An error occurred while processing this message.", true);
        }

        const givenReps = givingUser.model.reputation.given;

        let repPoints = 3;
        // redact reputation point for each reputation given in the last 24 hours
        for (const rep of givenReps) {
            if (moment().diff(rep, "hours") < 24) {
                repPoints--;
            }
        }

        if (!body) {
            // send reputation info about sender user
            const userRep = givingUser.model.reputation.reputation;
            return await messagingService.reply(
                message,
                `*Total reputation received:* ${userRep}\n*Reputation points remaining:* ${repPoints}`,
                true,
            );
        }

        const arg1 = body.split(" ")[0];
        const repPointsToGive = parseInt(arg1) === 0 ? 0 : parseInt(arg1) || 1;

        const mentions = message.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
        if (mentions.length === 0) {
            return await messagingService.reply(message, "You must mention someone to give them reputation!", true);
        } else if (mentions.length != 1) {
            return await messagingService.reply(message, "You must mention *one person* to give them reputation!", true);
        }

        // if rep points is less than or equal to 0, don't give any reputation
        if (repPoints <= 0 || repPointsToGive > repPoints) {
            return await messagingService.reply(
                message,
                `You can not give ${repPointsToGive} reputation point${havePluralS(repPointsToGive)}\
                while you only have ${repPoints} point${havePluralS(repPoints)} left`,
                true,
            );
        }

        const reppedJid = mentions[0];
        let reppedUser = await userRepository.get(reppedJid);
        if (!reppedUser) {
            reppedUser = await userRepository.simpleCreate(reppedJid);
            if (!reppedUser) {
                return await messagingService.reply(message, "The user you are trying to give reputation to doesn't exist.", true);
            }
        }
        const previousRep = reppedUser.model.reputation.reputation;

        reppedUser = await userRepository.update(reppedJid, {$set: {"reputation.reputation": reppedUser.model.reputation.reputation + 1}});
        if (!reppedUser) {
            return await messagingService.reply(message, "The user you are trying to give reputation to doesn't exist.", true);
        }
        await userRepository.update(message.sender, {$push: {"reputation.given": moment().unix()}});

        await messagingService.reply(
            message,
            `You've successfully given reputation!\n\n*@${jidDecode(reppedJid)} reputation:* ${previousRep} => ${
                reppedUser.model.reputation.reputation
            } (+${repPointsToGive})\n*Points left:* ${repPoints - repPointsToGive}`,
        );
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}