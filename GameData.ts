

export class Option {
    private _muteFX: boolean = false;
    private _muteBGM: boolean = false;

    private __appling: boolean = false;
    private readonly __muteEventListener = new LiteEvent<boolean>();
    private readonly __muteBGMEventListener = new LiteEvent<boolean>();

    public get muteFXListener() { return this.__muteEventListener.expose(); }
    public get muteFX() { return this._muteFX; }
    public set muteFX(flag: boolean) {
        if (this._muteFX !== flag) {
            this._muteFX = flag;

            this.__muteEventListener.emit(flag);

            this.onOptionChanged();
        }
    }

    public get muteBGMListener() { return this.__muteBGMEventListener.expose(); }
    public get muteBGM() { return this._muteBGM; }
    public set muteBGM(flag: boolean) {
        if (this._muteBGM !== flag) {
            this._muteBGM = flag;

            this.__muteBGMEventListener.emit(flag);

            this.onOptionChanged();
        }
    }

    private onOptionChanged() {
        if (this.__appling) return;
        cc.sys.localStorage.setItem("option", this.toJson());
    }

    toJson(): string {
        return JSON.stringify(this, (key: string, value: any) => {
            return key.startsWith("__") ? undefined : value;
        });
    }

    apply(optionOrString: Option | string | null) {
        if (optionOrString === null) return;
        let option: Option;

        if (typeof optionOrString === 'string') {
            option = JSON.parse(optionOrString) as Option;
        } else {
            option = optionOrString;
        }

        this.__appling = true;

        this.muteFX = !!option._muteFX;
        this.muteBGM = !!option._muteBGM;

        this.__appling = false;
    }
}

class TimedSyncData<T> {
    private lastSyncTime = 0;
    private _data: T;

    constructor(public interval: number, public snycFunc: Func0<Promise<T>>) { }

    async data(): Promise<T> {
        await this.sync();
        return this._data;
    }

    async sync() {
        if (this.lastSyncTime + this.interval >= Time.utcNow) return;

        this._data = await this.snycFunc();
    }
}


const ALREADY_FRIEND_REQUEST_REFRESH_INTERVAL = 5; // mins
export type AlreadyFriendRequests = { invitedList: string[], sentGiftList: string[] };


export class GameData {
    private _playResult: GameResultBase;
    private _machineState?: MachineState;
    private _lastMachineState?: MachineState;
    private _levelUpInfo: UserInfoResponse[] = []
    private _progressiveJackpot: CheckProgressiveJackpotResponse;
    public static tournaments: TournamentPoolSummaries = { pools: {}, machines: {} };
    private _simpleMailList: number[];
    private _friendRequests: TimedSyncData<AlreadyFriendRequests>;

    private _option: Option = new Option();


    static userInfo: UserInfoResponse;
    static permissions: Permission[];
    static purchaseCount: PurchaseCount;
    static abTestGroup: string;
    static currentMachineId: string | undefined;
    static alert: string | undefined;
    static totalbetBaseDuration: number = 0;
    static jsonWebToken: string;

    private static instance = new GameData();


    constructor() {
        this._friendRequests = new TimedSyncData(
            TimeUnit.toMilliseconds(ALREADY_FRIEND_REQUEST_REFRESH_INTERVAL, TimeUnit.Minutes),
            async () => {
                return await new Packet.GetAlreadAskedFriendInfos().send()
            }
        );
    }

    static addLevelUpInfo(userInfo: UserInfoResponse) {
        this.instance._levelUpInfo.push(userInfo);
    }

    static getLevelUpInfo(pop = true): UserInfoResponse | undefined {
        return pop ? this.instance._levelUpInfo.shift() : ArrayUtil.getFirst(this.instance._levelUpInfo);
    }

    static get playResult(): GameResultBase {
        return this.instance._playResult;
    }

    static set playResult(playResult: GameResultBase) {
        this.instance._playResult = playResult;
    }

    static get lastMachineState(): MachineState {
        return this.instance._lastMachineState!;
    }

    static get machineState(): MachineState {
        if (!this.instance._machineState) throw new Error("machine state is undefined");
        return this.instance._machineState;
    }

    static set machineState(newState: MachineState) {
        this.instance._lastMachineState = this.instance._machineState || newState;
        this.instance._machineState = newState;
    }

    static get progressiveJackpot() {
        return this.instance._progressiveJackpot;
    }

    static set progressiveJackpot(progressiveJackpot) {
        this.instance._progressiveJackpot = progressiveJackpot;
    }

    static get option() {
        return this.instance._option;
    }

    static getPayoutShowTime(payout: number, totalbet: number): number {
        let duration = 1;

        if (payout >= totalbet * Def.generalDef.effect.bigWin && payout < totalbet * Def.generalDef.effect.megaWin) {
            duration = 5;
        }
        else if (payout >= totalbet * Def.generalDef.effect.megaWin && payout < totalbet * Def.generalDef.effect.superMegaWin) {
            duration = 6;
        }
        else if (payout >= totalbet * Def.generalDef.effect.superMegaWin) {
            duration = 7;
        }

        this.totalbetBaseDuration = duration;
        cc.log("payout :" + payout + "=totalbet : " + totalbet + "=coin duration :" + duration);
        return duration;
    }


    static isBonusGameMode() {
        return this.machineState.bonusGame && this.machineState.bonusGame.stage !== "finished";
    }

    static isCollectGameMode() {
        this.machineState.collectGames && this.machineState.collectGames[0] && this.machineState.collectGames[0].stage === "main";
    }

    static clearMachineState() {
        this.instance._machineState = undefined;
        this.instance._lastMachineState = undefined;
    }

    static set simpleMailList(newList: number[]) {
        this.instance._simpleMailList = newList;
    }

    static get simpleMailList(): number[] {
        return this.instance._simpleMailList;
    }

    static async alreadyFriendRequestList(): Promise<AlreadyFriendRequests> {
        return this.instance._friendRequests.data();
    }
}