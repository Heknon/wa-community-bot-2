import {WASocket} from "@adiwajshing/baileys";
import {CommandTrigger} from "../../..";
import {BlockedReason} from "../../../../blockable";
import {Chat} from "../../../../chats";
import {messagingService, userRepository} from "../../../../constants/services";
import {Message} from "../../../../message";
import {EconomyCommand} from "../";
import {DeveloperLevel} from "../../../../database/models";
import {Balance} from "../../../../economy";

export default class GiveBalanceCommand extends EconomyCommand {
    constructor() {
        super({
            triggers: ["give balance", "give bal"].map((trigger) => new CommandTrigger(trigger)),
            category: "Economy",
            description: "Give balance to a user",
            usage: "{prefix}{command} @mention",
            developerLevel: DeveloperLevel.Operator,
        });
    }

    async execute(client: WASocket, chat: Chat, message: Message, body: string, ...args: string[]) {
        const mentions = message.mentions;
        const userJid = mentions.length > 0 ? mentions[0] : message.sender;
        if (!userJid) {
            return await messagingService.reply(message, "Must provide a user to check their balance.", true);
        }

        // extract number from body using regex
        const number = Number(body.match(/\d+/) ?? "");
        if (!number) {
            return await messagingService.reply(
                message,
                `Must provide an amount to give.\nTry ${chat.commandHandler?.prefix}give balance @mention <amount>`,
                true,
            );
        }

        const user = await userRepository.get(userJid);
        if (!user) {
            return await messagingService.reply(message, "User does not have a balance.", true);
        }

        const previousBalance = (await this.getBalance(userJid))!;
        const previousNet = await user.calculateNetBalance();
        const bankOrWallet = body.toLowerCase().includes("bank") ? "bank" : "wallet";

        const success = await this.addBalance(
            userJid,
            new Balance(bankOrWallet === "bank" ? 0 : number, bankOrWallet === "bank" ? number : 0),
        );
        if (!success) {
            return await messagingService.reply(message, "Failed to give balance.", true);
        }

        const currentBalance = (await this.getBalance(userJid))!;
        const currentNet = await user.calculateNetBalance();
        const netDiff = currentNet - previousNet;
        const walletDiff = currentBalance.wallet - previousBalance.wallet;
        const bankDiff = currentBalance.bank - previousBalance.bank;

        const walletText =
            "*Wallet:* " +
            (bankOrWallet === "bank"
                ? `${currentBalance.wallet}`
                : `${previousBalance.wallet} => ${currentBalance.wallet} (${walletDiff > 0 ? "+" : "-"}${walletDiff})`);
        const bankText =
            "*Bank:* " +
            (bankOrWallet === "wallet"
                ? `${currentBalance.bank}`
                : `${previousBalance.bank} => ${currentBalance.bank} (${bankDiff > 0 ? "+" : "-"}${bankDiff})`);

        const reply = `*@${
            userJid.split("@")[0]
        }'s balance*\n\n${walletText}\n*Bank:* ${bankText}\n*Net:* ${previousNet} => ${currentNet} (${
            netDiff > 0 ? "+" : "-"
        }${netDiff})`;
        return await messagingService.reply(message, reply, true);
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
