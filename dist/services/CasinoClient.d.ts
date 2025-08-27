declare class CasinoClient {
    private client;
    constructor();
    debit(data: any, headers: any): Promise<import("axios").AxiosResponse<any, any>>;
    credit(data: any, headers: any): Promise<import("axios").AxiosResponse<any, any>>;
    checkLimits(data: any, headers: any): Promise<import("axios").AxiosResponse<any, any>>;
    getBalance(data: any, headers: any): Promise<import("axios").AxiosResponse<any, any>>;
}
declare const _default: CasinoClient;
export default _default;
//# sourceMappingURL=CasinoClient.d.ts.map