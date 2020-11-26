import {createClient as createRedisClient} from "redis";
import url from "url";

const redisClient = (function() {
    const redis_uri = process.env.REDIS_URL ? url.parse(process.env.REDIS_URL as string) : undefined;
    if (process.env.REDIS_URL && redis_uri && redis_uri.protocol!.indexOf("rediss") === 0) {
        return createRedisClient({
            port: Number.parseInt(redis_uri.port!),
            host: redis_uri.hostname!,
            password: redis_uri.auth!.split(':')[1],
            db: 0,
            tls: {
                rejectUnauthorized: false,
                requestCert: true,
                agent: false
            }
        })
     } else {
         return createRedisClient(process.env.REDIS_URL as string);
     }
})();

export default () => {
    return redisClient;
}
