import {MediaType, WAMessage} from "@adiwajshing/baileys/lib/Types/Message";
import {isJidGroup} from "@adiwajshing/baileys/lib/WABinary/jid-utils";
import {ObjectId} from "mongodb";
import MessageModel from "../database/models/message_model";
import {getMessageMediaBuffer, getMessageMediaType} from "../utils/media_utils";
import {getMessageBody, getQuotedMessage} from "../utils/message_utils";
import {BotClient} from "../whatsapp_bot";
import MessageMetadata from "./message_metadata";

export default class Message {
    public model: MessageModel;
    private _quoted: Message | undefined;

    public raw: WAMessage | undefined;

    constructor(model: MessageModel, raw: WAMessage | undefined = undefined, quoted: Message | undefined = undefined) {
        this.model = model;
        this.raw = raw;
        this._quoted = quoted;
    }

    public inGroup() {
        return isJidGroup(this.model.to);
    }

    /**
     * Will be true if the message is from the bot
     */
    public get fromMe() {
        return this.model.from == BotClient.currentClientId;
    }

    public get sender() {
        if (isJidGroup(this.to)) return this.from;

        if (this.fromMe && this.raw?.key.fromMe) return BotClient.currentClientId;
        return this.fromMe ? this.to : this.from;
    }

    public static async fromWAMessage(
        message: WAMessage,
        metadata: MessageMetadata | undefined = undefined,
    ): Promise<Message> {
        const fromGroup = isJidGroup(message.key.remoteJid!);
        const fromMe = fromGroup
            ? message.key.participant! == BotClient.currentClientId ||
              message.participant! == BotClient.currentClientId ||
              message.key.fromMe
            : message.key.fromMe;
        const from = fromMe
            ? BotClient.currentClientId
            : fromGroup
            ? message.key.participant ?? message.participant
            : message.key.remoteJid!;
        const to = fromGroup ? message.key.remoteJid! : fromMe ? message.key.remoteJid! : BotClient.currentClientId;

        let quoted: WAMessage | undefined = getQuotedMessage(message);

        return new Message(
            new MessageModel(
                message.key.id!,
                Number(message.messageTimestamp!),
                getMessageBody(message),
                metadata?.meta.get("media") ?? true ? await getMessageMediaBuffer(message) : undefined,
                getMessageMediaType(message),
                quoted?.key?.id ?? undefined,
                from!,
                to!,
                metadata,
            ),
            message,
            quoted ? await this.fromWAMessage(quoted!) : undefined,
        );
    }

    public get from() {
        return this.model.from;
    }

    public get to() {
        return this.model.to;
    }

    public get content() {
        return this.model.content;
    }

    public get id() {
        return this.model.id;
    }

    public get media() {
        return this.model.media;
    }

    public get mediaType() {
        return this.model.mediaType;
    }

    public get metadata() {
        return this.model.metadata;
    }

    public get timestamp() {
        return this.model.timestamp;
    }

    public get mentions() {
        return this.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    }

    public async getQuoted(): Promise<Message | undefined> {
        if (this.model.quoted) {
            //  TODO: get quoted message from message repository.
        }

        return this._quoted;
    }
}
