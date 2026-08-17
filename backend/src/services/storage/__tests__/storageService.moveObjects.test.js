jest.mock('../../../config', () => ({
    storage: { provider: 'cloudflare-r2' }
}));

const mockProvider = {
    copyObject: jest.fn(),
    deleteObject: jest.fn()
};

jest.mock('../providers/cloudflareR2StorageProvider', () => mockProvider);

const storageService = require('../storageService');

const pairs = [
    { sourceKey: 'reviews/a.pdf', destinationKey: 'transactions/a.pdf' },
    { sourceKey: 'reviews/b.jpg', destinationKey: 'transactions/b.jpg' }
];

describe('storageService.moveObjects', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockProvider.copyObject.mockResolvedValue(undefined);
        mockProvider.deleteObject.mockResolvedValue(undefined);
    });

    it('copies every destination before deleting sources', async () => {
        await storageService.moveObjects(pairs);

        expect(mockProvider.copyObject).toHaveBeenCalledTimes(2);
        expect(mockProvider.deleteObject).toHaveBeenCalledTimes(2);
        expect(mockProvider.deleteObject).toHaveBeenNthCalledWith(1, {
            storageKey: 'reviews/a.pdf'
        });
    });

    it('removes successful destination copies when another copy fails', async () => {
        mockProvider.copyObject.mockImplementation(({ sourceKey }) => {
            if (sourceKey === 'reviews/b.jpg') {
                return Promise.reject(new Error('copy failed'));
            }
            return Promise.resolve();
        });

        await expect(storageService.moveObjects(pairs)).rejects.toMatchObject({
            code: 'STORAGE_MOVE_FAILED',
            phase: 'COPY'
        });
        expect(mockProvider.deleteObject).toHaveBeenCalledTimes(1);
        expect(mockProvider.deleteObject).toHaveBeenCalledWith({
            storageKey: 'transactions/a.pdf'
        });
    });

    it('restores deleted sources when a source deletion fails', async () => {
        mockProvider.deleteObject.mockImplementation(({ storageKey }) => {
            if (storageKey === 'reviews/b.jpg') {
                return Promise.reject(new Error('delete failed'));
            }
            return Promise.resolve();
        });

        await expect(storageService.moveObjects(pairs)).rejects.toMatchObject({
            code: 'STORAGE_MOVE_FAILED',
            phase: 'DELETE_SOURCE'
        });
        expect(mockProvider.copyObject).toHaveBeenCalledWith({
            sourceKey: 'transactions/a.pdf',
            destinationKey: 'reviews/a.pdf'
        });
        expect(mockProvider.deleteObject).toHaveBeenCalledWith({
            storageKey: 'transactions/a.pdf'
        });
        expect(mockProvider.deleteObject).toHaveBeenCalledWith({
            storageKey: 'transactions/b.jpg'
        });
    });
});
