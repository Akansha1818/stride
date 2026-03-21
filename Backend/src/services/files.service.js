const path = require("path");
const {
  BlobServiceClient,
  BlobSASPermissions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} = require("@azure/storage-blob");

const REQUIRED_ENV_VARS = ["AZURE_STORAGE_CONNECTION_STRING", "AZURE_STORAGE_CONTAINER_NAME"];
const SAS_EXPIRY_HOURS = Number(process.env.AZURE_UPLOAD_SAS_EXPIRY_HOURS) || 1;
let containerClientPromise;
let blobServiceClientInstance;
let sharedKeyCredentialInstance;
let parsedConnectionStringCache;

class UploadServiceError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "UploadServiceError";
    this.statusCode = statusCode;
  }
}

const getMissingEnvVars = () => REQUIRED_ENV_VARS.filter((envVar) => !process.env[envVar]);

const parseConnectionString = () => {
  if (!parsedConnectionStringCache) {
    parsedConnectionStringCache = process.env.AZURE_STORAGE_CONNECTION_STRING.split(";").reduce(
      (acc, segment) => {
        const [key, ...valueParts] = segment.split("=");

        if (key && valueParts.length) {
          acc[key] = valueParts.join("=");
        }

        return acc;
      },
      {}
    );
  }

  return parsedConnectionStringCache;
};

const ensureConfigured = () => {
  const missingEnvVars = getMissingEnvVars();

  if (missingEnvVars.length > 0) {
    throw new UploadServiceError(
      `Azure Blob Storage is not configured. Missing env vars: ${missingEnvVars.join(", ")}`,
      500
    );
  }
};

const getBlobServiceClient = () => {
  ensureConfigured();

  if (!blobServiceClientInstance) {
    blobServiceClientInstance = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );
  }

  return blobServiceClientInstance;
};

const getSharedKeyCredential = () => {
  ensureConfigured();

  if (!sharedKeyCredentialInstance) {
    const connectionValues = parseConnectionString();
    const accountName = connectionValues.AccountName;
    const accountKey = connectionValues.AccountKey;

    if (!accountName || !accountKey) {
      throw new UploadServiceError(
        "Azure connection string must include AccountName and AccountKey to generate SAS URLs.",
        500
      );
    }

    sharedKeyCredentialInstance = new StorageSharedKeyCredential(accountName, accountKey);
  }

  return sharedKeyCredentialInstance;
};

const getContainerClient = async () => {
  if (!containerClientPromise) {
    const blobServiceClient = getBlobServiceClient();
    const containerClient = blobServiceClient.getContainerClient(
      process.env.AZURE_STORAGE_CONTAINER_NAME
    );

    containerClientPromise = containerClient.createIfNotExists().then(() => containerClient);
  }

  return containerClientPromise;
};

const sanitizeFilename = (filename) =>
  String(filename)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "") || "video";

const normalizeExtension = (filename, contentType) => {
  const explicitExtension = path.extname(filename || "").toLowerCase();

  if (explicitExtension) {
    return explicitExtension;
  }

  const mimeMap = {
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/x-msvideo": ".avi",
    "video/x-matroska": ".mkv",
    "video/webm": ".webm",
  };

  return mimeMap[contentType] || ".mp4";
};

const buildBlobName = ({ userId, filename, originalFileName, contentType }) => {
  if (!userId) {
    throw new UploadServiceError("userId is required to generate an upload URL.", 400);
  }

  const referenceName = originalFileName || filename || "video";
  const extension = normalizeExtension(referenceName, contentType);
  const baseName = sanitizeFilename(path.basename(filename || referenceName, path.extname(filename || referenceName)));
  const uniqueName = `${userId}-${Date.now()}-${baseName}${extension}`;

  return path.posix.join("Stride", String(userId), uniqueName);
};

const validateBlobOwnership = (blobName, userId) => {
  const expectedPrefix = `Stride/${String(userId)}/`;

  if (!blobName || !blobName.startsWith(expectedPrefix)) {
    throw new UploadServiceError("Invalid blobName for the current user.", 403);
  }
};

const buildBlobUrl = async (blobName) => {
  const containerClient = await getContainerClient();
  return containerClient.getBlockBlobClient(blobName).url;
};

const buildCdnUrl = (blobName) => {
  const cdnBaseUrl = process.env.AZURE_CDN_BASE_URL?.trim();

  if (!cdnBaseUrl) {
    return null;
  }

  return `${cdnBaseUrl.replace(/\/+$/, "")}/${blobName}`;
};

const blobExists = async (blobName) => {
  const containerClient = await getContainerClient();
  return containerClient.getBlockBlobClient(blobName).exists();
};

const createBlobSasUrl = async ({ blobName, permissions, expiresOn }) => {
  const containerClient = await getContainerClient();
  const sharedKeyCredential = getSharedKeyCredential();
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: process.env.AZURE_STORAGE_CONTAINER_NAME,
      blobName,
      permissions: BlobSASPermissions.parse(permissions),
      startsOn: new Date(Date.now() - 5 * 60 * 1000),
      expiresOn,
      protocol: "https",
    },
    sharedKeyCredential
  ).toString();

  return `${containerClient.getBlockBlobClient(blobName).url}?${sasToken}`;
};

const generateUploadUrl = async ({ userId, filename, originalFileName, contentType, blobName }) => {
  const nextBlobName = blobName || buildBlobName({ userId, filename, originalFileName, contentType });

  validateBlobOwnership(nextBlobName, userId);

  return {
    blobName: nextBlobName,
    sasUrl: await createBlobSasUrl({
      blobName: nextBlobName,
      permissions: "cw",
      expiresOn: new Date(Date.now() + SAS_EXPIRY_HOURS * 60 * 60 * 1000),
    }),
  };
};

const generateReadUrl = async (blobName, expiresInMinutes = 60) => {
  const expiresOn = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  return createBlobSasUrl({
    blobName,
    permissions: "r",
    expiresOn,
  });
};

module.exports = {
  UploadServiceError,
  blobExists,
  buildBlobName,
  buildBlobUrl,
  buildCdnUrl,
  generateReadUrl,
  generateUploadUrl,
};
