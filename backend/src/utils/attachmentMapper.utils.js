function normalizeAttachment(attachment) {
    const id = attachment?._id ?? attachment?.id;

    return {
        id: id.toString(),
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        uploadedAt: attachment.uploadedAt?.toISOString?.() ?? null
    };
}

module.exports = { normalizeAttachment };
