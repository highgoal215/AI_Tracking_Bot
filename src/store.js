const store = {
    currentPrompt: {
        prompt: '',
        data: {},
    },

    getCurrentPrompt() {
        return this.currentPrompt;
    },

    setCurrentPrompt(newPrompt, newData) {
        this.currentPrompt = { prompt: newPrompt, data: newData };
    },

    clearCurrentPrompt() {
        this.currentPrompt = { prompt: '', data: {} };
    },
};

module.exports = store;
