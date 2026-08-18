const { GraphQLError } = require('graphql');
const UserPreferences = require('../models/UserPreferences');
const { updateAppStatus } = require('../controllers/updateAppStatusController');

function validateOnboardingInput(input) {
    if (typeof input?.isBetaUser !== 'boolean') {
        throw new GraphQLError('isBetaUser must be a boolean value', {
            extensions: { code: 'BAD_USER_INPUT' }
        });
    }

    if (typeof input?.autoProcess !== 'boolean') {
        throw new GraphQLError('autoProcess must be a boolean value', {
            extensions: { code: 'BAD_USER_INPUT' }
        });
    }

    return {
        isBetaUser: input.isBetaUser,
        autoProcess: input.autoProcess
    };
}

async function onboardUserService(userId, input) {
    if (!userId) {
        throw new GraphQLError('User not authenticated', {
            extensions: { code: 'UNAUTHENTICATED' }
        });
    }

    const validatedInput = validateOnboardingInput(input);

    try {
        const preferences = await UserPreferences.findOneAndUpdate(
            { userId },
            {
                $set: {
                    userId,
                    isBetaUser: validatedInput.isBetaUser,
                    autoProcess: validatedInput.autoProcess
                }
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        await updateAppStatus(userId, { onboarded: true });

        return {
            success: true,
            message: 'Onboarding completed successfully',
            data: {
                isBetaUser: preferences.isBetaUser,
                autoProcess: preferences.autoProcess,
                onboarded: true
            }
        };
    } catch (error) {
        if (error instanceof GraphQLError) {
            throw error;
        }

        console.error('Error completing onboarding:', error);
        throw new GraphQLError('Failed to complete onboarding. Please try again.', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
    }
}

module.exports = {
    onboardUserService
};
