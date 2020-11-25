export interface QuoteContext {
    canvasApi? : string;
    isCanvas : boolean;
    accessToken : string;
    opportunityId? : string;
    instanceUrl : string;
    restUrl : string;
    user : ApplicationUser;
}
export interface ApplicationUser {
    userId : string;
    userName : string;
    fullName : string;
    email : string;
    profilePhotoUrl : string;
    profileThumbnailUrl : string;
    currency : string;
}
