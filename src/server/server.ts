import { App, RequestHead, Response, RequestReader, CommonResponseBuilder, StatusResponseBuilder } from '../app';
import { URL } from 'url';
import { BeforeHook } from './request-reader';
import { AddressInfo } from 'net';
import { StatusCodes } from '../app/status';


export type AfterHook = (request: RequestHead, response: Response) => Response;

export abstract class Server {
    abstract listen(port: number, onListening?: () => void): this;
    abstract stop(): Promise<{}>;
    abstract get isListening(): boolean;
    abstract get addressInfo(): AddressInfo | undefined;

    private _before: BeforeHook[] = [];
    private _after: AfterHook[] = [];
    private apps = new Map<string, App>();

    private getAppFromRequest(requestReader: RequestReader) {
        const name = requestReader.head.appName;
        return this.get(name || '/');
    }

    protected getAppNameAndRoute(url: URL) {
        const fragments = url.pathname.split('/');
        return {
            appName: '/' + (fragments[1] || ''),
            route: '/' + fragments.slice(2).join('/')
        };
    }

    async resolve(requestReader: RequestReader): Promise<Response> {
        const app = this.getAppFromRequest(requestReader);
        if (!app) {
            return new StatusResponseBuilder(StatusCodes.NotFound).build();
        }

        // Resolution
        const responseBuilder = await app.resolve(requestReader);
        return responseBuilder.build();
    }

    get(name: string) {
        return this.apps.get(name);
    }

    app(app: App): this {
        this.apps.set(app.name, app);

        return this;
    }

    before(hook: BeforeHook): this {
        this._before.push(hook);
        return this;
    }

    after(hook: AfterHook): this {
        this._after.push(hook);
        return this;
    }

    containsApp(app: App): boolean {
        return this.apps.has(app.name);
    }

    getBeforeMiddleware(): BeforeHook {
        return request => {
            return this._before.reduce((request, hook) => {
                return hook(request);
            }, request);
        };
    }

    getAfterMiddleware(): AfterHook {
        return (request, response) => {
            return this._after.reduce((response, hook) => {
                return hook(request, response);
            }, response);
        };
    }
}