/**
 * LLM Chat Assistant
 * Fixed version with improved error handling and functionality
 */

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing chat app...');
  new ChatApp();
});

class ChatApp {
  constructor() {
    console.log('ChatApp constructor called');
    
    // App state
    this.state = {
      messages: [],
      prompts: [],
      activePromptId: null,
      settings: {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'demo-key-12345',
        customEndpoint: ''
      },
      isLoading: false
    };

    // Default system prompt
    this.defaultPrompt = {
      id: 'default',
      name: 'Обычный ассистент',
      content: 'Ты полезный ИИ-ассистент. Отвечай на вопросы пользователя максимально точно и подробно.'
    };

    // Default API models
    this.defaultModels = {
      openai: 'gpt-4',
      google: 'gemini-pro',
      azure: 'gpt-4',
      custom: ''
    };

    // Serverless platforms data
    this.serverlessPlatforms = [
      {
        name: "Vercel Functions",
        description: "Простое развертывание с Next.js",
        example: "export default function handler(req, res) { /* API logic */ }"
      },
      {
        name: "Netlify Functions",
        description: "JAMstack интеграция",
        example: "exports.handler = async (event, context) => { /* API logic */ }"
      },
      {
        name: "Deno Deploy",
        description: "TypeScript и современные Web APIs",
        example: "Deno.serve((req) => { /* API logic */ })"
      },
      {
        name: "Cloudflare Workers",
        description: "Edge computing по всему миру",
        example: "addEventListener('fetch', event => { /* API logic */ })"
      }
    ];

    // Initialize application
    this.init();
  }

  init() {
    console.log('Initializing app...');
    
    // Small delay to ensure DOM is fully ready
    setTimeout(() => {
      this.setupApplication();
    }, 100);
  }

  setupApplication() {
    console.log('Setting up application...');
    
    try {
      this.getDOMElements();
      this.loadFromLocalStorage();
      this.setupEventListeners();
      this.renderPrompts();
      this.populateServerlessPlatforms();
      this.updateUIFromState();
      
      // Auto-select default prompt if no prompt is active
      if (!this.state.activePromptId && this.state.prompts.length > 0) {
        console.log('Auto-selecting default prompt...');
        this.setActivePrompt(this.state.prompts[0].id);
      }
      
      console.log('Application setup complete');
    } catch (error) {
      console.error('Error setting up application:', error);
    }
  }

  getDOMElements() {
    console.log('Getting DOM elements...');
    
    this.elements = {
      // Chat interface
      chatMessages: document.getElementById('chat-messages'),
      chatInput: document.getElementById('chat-input'),
      sendButton: document.getElementById('send-message'),
      activePromptName: document.getElementById('active-prompt-name'),
      
      // Sidebar
      sidebar: document.getElementById('sidebar'),
      promptsList: document.getElementById('prompts-list'),
      toggleSidebar: document.getElementById('toggle-sidebar'),
      showSidebar: document.getElementById('show-sidebar'),
      
      // Modals
      settingsModal: document.getElementById('settings-modal'),
      promptModal: document.getElementById('prompt-modal'),
      serverlessModal: document.getElementById('serverless-modal'),
      
      // Buttons
      settingsBtn: document.getElementById('settings-btn'),
      newPromptBtn: document.getElementById('new-prompt-btn'),
      savePromptBtn: document.getElementById('save-prompt'),
      deletePromptBtn: document.getElementById('delete-prompt'),
      saveSettings: document.getElementById('save-settings'),
      clearChatBtn: document.getElementById('clear-chat-btn'),
      serverlessInfoBtn: document.getElementById('serverless-info-btn'),
      closeModalBtns: document.querySelectorAll('.close-modal'),
      
      // Form elements
      apiProvider: document.getElementById('api-provider'),
      apiModel: document.getElementById('api-model'),
      apiKey: document.getElementById('api-key'),
      customEndpoint: document.getElementById('custom-endpoint'),
      customEndpointContainer: document.querySelector('.custom-endpoint-container'),
      promptName: document.getElementById('prompt-name'),
      promptContent: document.getElementById('prompt-content'),
      promptId: document.getElementById('prompt-id'),
      promptModalTitle: document.getElementById('prompt-modal-title'),
      
      // Loading
      loadingOverlay: document.getElementById('loading-overlay'),
      
      // Serverless info
      serverlessPlatforms: document.getElementById('serverless-platforms')
    };

    // Log missing elements
    Object.keys(this.elements).forEach(key => {
      if (!this.elements[key]) {
        console.warn(`Element not found: ${key}`);
      }
    });
  }

  loadFromLocalStorage() {
    console.log('Loading from localStorage...');
    
    try {
      // Load settings
      const savedSettings = localStorage.getItem('chat_app_settings');
      if (savedSettings) {
        this.state.settings = { ...this.state.settings, ...JSON.parse(savedSettings) };
      }
      
      // Load prompts
      const savedPrompts = localStorage.getItem('chat_app_prompts');
      if (savedPrompts) {
        this.state.prompts = JSON.parse(savedPrompts);
      } else {
        this.state.prompts = [this.defaultPrompt];
      }
      
      // Load active prompt
      const activePromptId = localStorage.getItem('chat_app_active_prompt');
      if (activePromptId && this.state.prompts.find(p => p.id === activePromptId)) {
        this.state.activePromptId = activePromptId;
      }
      
      // Load chat history
      const savedMessages = localStorage.getItem('chat_app_messages');
      if (savedMessages) {
        this.state.messages = JSON.parse(savedMessages);
      }
      
      console.log('Data loaded from localStorage');
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      this.state.prompts = [this.defaultPrompt];
      this.state.activePromptId = null;
      this.state.messages = [];
    }
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem('chat_app_settings', JSON.stringify(this.state.settings));
      localStorage.setItem('chat_app_prompts', JSON.stringify(this.state.prompts));
      localStorage.setItem('chat_app_active_prompt', this.state.activePromptId || '');
      localStorage.setItem('chat_app_messages', JSON.stringify(this.state.messages));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  setupEventListeners() {
    console.log('Setting up event listeners...');

    // Chat input events
    if (this.elements.chatInput) {
      console.log('Setting up chat input events');
      
      this.elements.chatInput.addEventListener('input', (e) => {
        console.log('Chat input changed:', e.target.value);
        this.handleInputResize();
      });
      
      this.elements.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          console.log('Enter pressed, sending message');
          this.sendMessage();
        }
      });
      
      // Test input functionality
      this.elements.chatInput.addEventListener('focus', () => {
        console.log('Chat input focused');
      });
    } else {
      console.error('Chat input element not found!');
    }

    // Send button
    if (this.elements.sendButton) {
      this.elements.sendButton.addEventListener('click', (e) => {
        console.log('Send button clicked');
        this.sendMessage();
      });
    }
    
    // Sidebar toggle
    if (this.elements.toggleSidebar) {
      this.elements.toggleSidebar.addEventListener('click', () => {
        console.log('Toggle sidebar clicked');
        this.toggleSidebar();
      });
    }
    
    if (this.elements.showSidebar) {
      this.elements.showSidebar.addEventListener('click', () => {
        console.log('Show sidebar clicked');
        this.showSidebar();
      });
    }
    
    // Modal buttons
    if (this.elements.settingsBtn) {
      this.elements.settingsBtn.addEventListener('click', () => {
        console.log('Settings button clicked');
        this.openSettingsModal();
      });
    }
    
    if (this.elements.newPromptBtn) {
      this.elements.newPromptBtn.addEventListener('click', () => {
        console.log('New prompt button clicked');
        this.openNewPromptModal();
      });
    }
    
    if (this.elements.savePromptBtn) {
      this.elements.savePromptBtn.addEventListener('click', () => {
        console.log('Save prompt button clicked');
        this.savePrompt();
      });
    }
    
    if (this.elements.deletePromptBtn) {
      this.elements.deletePromptBtn.addEventListener('click', () => {
        console.log('Delete prompt button clicked');
        this.deletePrompt();
      });
    }
    
    if (this.elements.saveSettings) {
      this.elements.saveSettings.addEventListener('click', () => {
        console.log('Save settings button clicked');
        this.saveSettings();
      });
    }
    
    if (this.elements.clearChatBtn) {
      this.elements.clearChatBtn.addEventListener('click', () => {
        console.log('Clear chat button clicked');
        this.clearChat();
      });
    }
    
    if (this.elements.serverlessInfoBtn) {
      this.elements.serverlessInfoBtn.addEventListener('click', () => {
        console.log('Serverless info button clicked');
        this.openServerlessModal();
      });
    }
    
    // API provider change
    if (this.elements.apiProvider) {
      this.elements.apiProvider.addEventListener('change', () => {
        console.log('API provider changed');
        this.handleProviderChange();
      });
    }
    
    // Close modal buttons
    this.elements.closeModalBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        console.log('Close modal button clicked');
        this.closeModals();
      });
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
      if (event.target.classList.contains('modal')) {
        console.log('Modal background clicked');
        this.closeModals();
      }
    });

    console.log('Event listeners setup complete');
  }

  updateUIFromState() {
    console.log('Updating UI from state...');
    
    this.updateActivePromptDisplay();
    
    // Update settings form
    if (this.elements.apiProvider) {
      this.elements.apiProvider.value = this.state.settings.provider;
    }
    if (this.elements.apiModel) {
      this.elements.apiModel.value = this.state.settings.model || this.defaultModels[this.state.settings.provider];
    }
    if (this.elements.apiKey) {
      this.elements.apiKey.value = this.state.settings.apiKey;
    }
    if (this.elements.customEndpoint) {
      this.elements.customEndpoint.value = this.state.settings.customEndpoint || '';
    }
    
    this.handleProviderChange();
    this.renderMessages();
    this.updateSendButtonState();
  }

  updateSendButtonState() {
    if (!this.elements.chatInput || !this.elements.sendButton) return;
    
    const hasText = this.elements.chatInput.value.trim() !== '';
    const hasActivePrompt = !!this.state.activePromptId;
    
    console.log('Updating send button state:', { hasText, hasActivePrompt });
    
    this.elements.sendButton.disabled = !hasText || !hasActivePrompt;
  }

  handleInputResize() {
    if (!this.elements.chatInput) return;
    
    const input = this.elements.chatInput;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    this.updateSendButtonState();
  }

  setActivePrompt(promptId) {
    console.log('Setting active prompt:', promptId);
    
    this.state.activePromptId = promptId;
    this.saveToLocalStorage();
    this.updateActivePromptDisplay();
    this.renderPrompts();
    this.updateSendButtonState();
  }

  updateActivePromptDisplay() {
    if (!this.elements.activePromptName) return;
    
    if (this.state.activePromptId) {
      const activePrompt = this.state.prompts.find(p => p.id === this.state.activePromptId);
      if (activePrompt) {
        this.elements.activePromptName.textContent = activePrompt.name;
        console.log('Active prompt updated:', activePrompt.name);
        return;
      }
    }
    
    this.elements.activePromptName.textContent = 'Не выбран';
  }

  renderPrompts() {
    console.log('Rendering prompts...');
    
    if (!this.elements.promptsList) {
      console.error('Prompts list element not found');
      return;
    }
    
    this.elements.promptsList.innerHTML = '';
    
    this.state.prompts.forEach(prompt => {
      const promptElement = document.createElement('div');
      promptElement.className = 'prompt-item';
      promptElement.tabIndex = 0;
      promptElement.setAttribute('data-id', prompt.id);
      
      if (this.state.activePromptId === prompt.id) {
        promptElement.classList.add('active');
      }
      
      promptElement.innerHTML = `
        <div class="prompt-info">
          <h3 class="prompt-name">${this.escapeHTML(prompt.name)}</h3>
          <p class="prompt-preview">${this.escapeHTML(prompt.content.substring(0, 50))}${prompt.content.length > 50 ? '...' : ''}</p>
        </div>
        <div class="prompt-actions">
          <button class="edit-prompt" title="Редактировать промпт">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        </div>
      `;
      
      // Add click event to set active prompt
      promptElement.addEventListener('click', (event) => {
        if (!event.target.closest('.edit-prompt')) {
          console.log('Prompt clicked:', prompt.id);
          this.setActivePrompt(prompt.id);
        }
      });
      
      // Add click event to edit prompt
      const editButton = promptElement.querySelector('.edit-prompt');
      if (editButton) {
        editButton.addEventListener('click', (event) => {
          event.stopPropagation();
          console.log('Edit prompt clicked:', prompt.id);
          this.openEditPromptModal(prompt.id);
        });
      }
      
      this.elements.promptsList.appendChild(promptElement);
    });
    
    console.log('Prompts rendered:', this.state.prompts.length);
  }

  async sendMessage() {
    console.log('Sending message...');
    
    if (!this.elements.chatInput) {
      console.error('Chat input not found');
      return;
    }
    
    const message = this.elements.chatInput.value.trim();
    console.log('Message to send:', message);
    
    if (!message) {
      console.log('No message to send');
      return;
    }
    
    if (!this.state.activePromptId) {
      alert('Пожалуйста, выберите системный промпт прежде чем отправить сообщение.');
      return;
    }
    
    // Add user message
    this.addMessage('user', message);
    
    // Clear input
    this.elements.chatInput.value = '';
    this.elements.chatInput.style.height = 'auto';
    this.updateSendButtonState();
    
    // Show loading
    this.setLoading(true);
    
    try {
      console.log('Getting AI response...');
      const response = await this.getAIResponse(message);
      console.log('AI response received');
      this.addMessage('assistant', response);
    } catch (error) {
      console.error('Error getting AI response:', error);
      this.addMessage('assistant', 'Произошла ошибка при получении ответа. Пожалуйста, попробуйте снова.');
    } finally {
      this.setLoading(false);
    }
  }

  async getAIResponse(userMessage) {
    const activePrompt = this.state.prompts.find(p => p.id === this.state.activePromptId);
    if (!activePrompt) {
      throw new Error('Активный промпт не найден.');
    }
    
    // Simulate API delay
    const delay = Math.floor(Math.random() * 1500) + 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Generate response
    return this.generateSimpleResponse(userMessage, activePrompt, this.state.settings);
  }

  generateSimpleResponse(userMessage, activePrompt, settings) {
    const isQuestion = userMessage.includes('?') || userMessage.toLowerCase().includes('что') || 
                     userMessage.toLowerCase().includes('как') || userMessage.toLowerCase().includes('почему');
    
    let response = '';
    
    if (userMessage.toLowerCase().includes('машинное обучение') || 
        userMessage.toLowerCase().includes('machine learning')) {
      response = `# Машинное обучение

**Машинное обучение** — это подраздел искусственного интеллекта, который позволяет компьютерам обучаться и принимать решения на основе данных без явного программирования для каждой конкретной задачи.

## Основные типы:

1. **Обучение с учителем** - алгоритм обучается на размеченных данных
2. **Обучение без учителя** - поиск скрытых закономерностей в данных
3. **Обучение с подкреплением** - обучение через взаимодействие со средой

## Применение:
- Распознавание изображений
- Обработка естественного языка
- Рекомендательные системы
- Автономное вождение
- Медицинская диагностика

Машинное обучение революционизирует множество отраслей, позволяя автоматизировать сложные задачи анализа данных.`;
    } else if (isQuestion) {
      response = `Отличный вопрос! На основе системного промпта "${activePrompt.name}", я постараюсь дать вам полезный ответ.

${userMessage.toLowerCase().includes('как') ? 
  'Для понимания этого процесса важно разбить его на этапы и рассмотреть каждый детально.' : 
  'Этот вопрос затрагивает важную тему, которая заслуживает подробного рассмотрения.'
}

**Ключевые моменты:**
- Понимание основных принципов помогает в практическом применении
- Контекст и специфика ситуации всегда важны
- Лучший подход — начать с базовых концепций и постепенно углубляться

Если у вас есть более конкретные аспекты, которые вас интересуют, я буду рад разобрать их подробнее!`;
    } else {
      response = `Спасибо за ваше сообщение! Как ${activePrompt.name.toLowerCase()}, я готов помочь вам с любыми вопросами.

Ваше сообщение: "${userMessage}"

Я понимаю, что вы хотите обсудить эту тему. Вот что я могу сказать:

- Это интересная область для изучения
- Есть множество подходов к решению подобных задач  
- Практический опыт часто является лучшим учителем

Пожалуйста, не стесняйтесь задавать более конкретные вопросы — я буду рад предоставить более детальную информацию!`;
    }
    
    // Add provider signature
    response += `\n\n---\n*Демонстрационный ответ от ${this.getProviderName(settings.provider)} (${settings.model})*`;
    
    return response;
  }

  getProviderName(provider) {
    const names = {
      openai: 'OpenAI',
      google: 'Google Gemini',
      azure: 'Azure OpenAI',
      custom: 'Custom API'
    };
    return names[provider] || 'Unknown Provider';
  }

  addMessage(role, content) {
    console.log('Adding message:', role, content.substring(0, 50) + '...');
    
    const message = { role, content, timestamp: new Date().toISOString() };
    this.state.messages.push(message);
    this.saveToLocalStorage();
    
    // Hide welcome message if it exists
    if (this.elements.chatMessages) {
      const welcomeMessage = this.elements.chatMessages.querySelector('.welcome-message');
      if (welcomeMessage) {
        welcomeMessage.remove();
      }
      
      this.renderMessage(message);
      this.scrollToBottom();
    }
  }

  renderMessages() {
    if (!this.elements.chatMessages) return;
    
    console.log('Rendering messages:', this.state.messages.length);
    
    this.elements.chatMessages.innerHTML = '';
    
    if (this.state.messages.length === 0) {
      this.elements.chatMessages.appendChild(this.createWelcomeMessage());
      return;
    }
    
    this.state.messages.forEach(message => {
      this.renderMessage(message);
    });
    
    this.scrollToBottom();
  }

  createWelcomeMessage() {
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    welcomeDiv.innerHTML = `
      <h2>Добро пожаловать в LLM Chat Assistant</h2>
      <p>Выберите системный промпт и начните общение с ИИ-ассистентом.</p>
      <p><strong>Демонстрационный режим:</strong> Этот ассистент использует симуляцию API для демонстрации функциональности.</p>
    `;
    return welcomeDiv;
  }

  renderMessage(message) {
    if (!this.elements.chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${message.role}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    if (message.role === 'user') {
      messageContent.textContent = message.content;
    } else {
      // Try to use marked library for markdown, fallback to simple formatting
      if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
        try {
          messageContent.innerHTML = DOMPurify.sanitize(marked.parse(message.content));
        } catch (error) {
          console.warn('Error parsing markdown, using fallback');
          messageContent.innerHTML = this.formatText(message.content);
        }
      } else {
        messageContent.innerHTML = this.formatText(message.content);
      }
    }
    
    messageDiv.appendChild(messageContent);
    this.elements.chatMessages.appendChild(messageDiv);
  }

  formatText(text) {
    return this.escapeHTML(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/#{1,6}\s+(.*?)(?=<br>|<\/p>)/g, '<h3>$1</h3>')
      .replace(/^- (.*?)(?=<br>|<\/p>)/gm, '<li>$1</li>')
      .replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
  }

  scrollToBottom() {
    if (this.elements.chatMessages) {
      setTimeout(() => {
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
      }, 100);
    }
  }

  setLoading(isLoading) {
    this.state.isLoading = isLoading;
    if (this.elements.loadingOverlay) {
      if (isLoading) {
        this.elements.loadingOverlay.classList.add('show');
      } else {
        this.elements.loadingOverlay.classList.remove('show');
      }
    }
  }

  // Modal functions
  openSettingsModal() {
    if (this.elements.settingsModal) {
      this.elements.settingsModal.classList.add('show');
    }
  }

  openNewPromptModal() {
    if (this.elements.promptModalTitle) {
      this.elements.promptModalTitle.textContent = 'Новый промпт';
    }
    if (this.elements.promptName) this.elements.promptName.value = '';
    if (this.elements.promptContent) this.elements.promptContent.value = '';
    if (this.elements.promptId) this.elements.promptId.value = '';
    if (this.elements.deletePromptBtn) this.elements.deletePromptBtn.style.display = 'none';
    if (this.elements.promptModal) {
      this.elements.promptModal.classList.add('show');
    }
  }

  openEditPromptModal(promptId) {
    const prompt = this.state.prompts.find(p => p.id === promptId);
    if (!prompt) return;
    
    if (this.elements.promptModalTitle) {
      this.elements.promptModalTitle.textContent = 'Редактировать промпт';
    }
    if (this.elements.promptName) this.elements.promptName.value = prompt.name;
    if (this.elements.promptContent) this.elements.promptContent.value = prompt.content;
    if (this.elements.promptId) this.elements.promptId.value = prompt.id;
    if (this.elements.deletePromptBtn) this.elements.deletePromptBtn.style.display = 'block';
    if (this.elements.promptModal) {
      this.elements.promptModal.classList.add('show');
    }
  }

  openServerlessModal() {
    if (this.elements.serverlessModal) {
      this.elements.serverlessModal.classList.add('show');
    }
  }

  closeModals() {
    if (this.elements.settingsModal) this.elements.settingsModal.classList.remove('show');
    if (this.elements.promptModal) this.elements.promptModal.classList.remove('show');
    if (this.elements.serverlessModal) this.elements.serverlessModal.classList.remove('show');
    if (this.elements.sidebar) this.elements.sidebar.classList.remove('show');
  }

  saveSettings() {
    this.state.settings = {
      provider: this.elements.apiProvider?.value || 'openai',
      model: this.elements.apiModel?.value || 'gpt-4',
      apiKey: this.elements.apiKey?.value || 'demo-key',
      customEndpoint: this.elements.customEndpoint?.value || ''
    };
    
    this.saveToLocalStorage();
    this.closeModals();
    alert('Настройки сохранены!');
  }

  savePrompt() {
    const name = this.elements.promptName?.value.trim() || '';
    const content = this.elements.promptContent?.value.trim() || '';
    const existingId = this.elements.promptId?.value || '';
    
    if (!name || !content) {
      alert('Пожалуйста, заполните все поля.');
      return;
    }
    
    if (existingId) {
      const promptIndex = this.state.prompts.findIndex(p => p.id === existingId);
      if (promptIndex !== -1) {
        this.state.prompts[promptIndex] = { id: existingId, name, content };
      }
    } else {
      const newPrompt = { id: Date.now().toString(), name, content };
      this.state.prompts.push(newPrompt);
    }
    
    this.saveToLocalStorage();
    this.renderPrompts();
    this.closeModals();
    alert('Промпт сохранен!');
  }

  deletePrompt() {
    const promptId = this.elements.promptId?.value;
    if (!promptId) return;
    
    if (confirm('Вы уверены, что хотите удалить этот промпт?')) {
      this.state.prompts = this.state.prompts.filter(p => p.id !== promptId);
      
      if (this.state.activePromptId === promptId) {
        this.state.activePromptId = null;
        this.updateActivePromptDisplay();
      }
      
      this.saveToLocalStorage();
      this.renderPrompts();
      this.closeModals();
    }
  }

  clearChat() {
    if (confirm('Вы уверены, что хотите очистить историю чата?')) {
      this.state.messages = [];
      this.saveToLocalStorage();
      this.renderMessages();
    }
  }

  handleProviderChange() {
    if (!this.elements.apiProvider) return;
    
    const provider = this.elements.apiProvider.value;
    const defaultModel = this.defaultModels[provider];
    
    if (this.elements.apiModel) {
      this.elements.apiModel.placeholder = defaultModel;
      if (!this.elements.apiModel.value) {
        this.elements.apiModel.value = defaultModel;
      }
    }
    
    if (this.elements.customEndpointContainer) {
      this.elements.customEndpointContainer.style.display = 
        provider === 'custom' ? 'block' : 'none';
    }
  }

  toggleSidebar() {
    if (this.elements.sidebar) {
      this.elements.sidebar.classList.toggle('collapsed');
    }
  }

  showSidebar() {
    if (this.elements.sidebar) {
      this.elements.sidebar.classList.add('show');
    }
  }

  populateServerlessPlatforms() {
    if (!this.elements.serverlessPlatforms) return;
    
    this.elements.serverlessPlatforms.innerHTML = '';
    
    this.serverlessPlatforms.forEach(platform => {
      const platformCard = document.createElement('div');
      platformCard.className = 'platform-card';
      
      platformCard.innerHTML = `
        <h3 class="platform-name">${platform.name}</h3>
        <p class="platform-description">${platform.description}</p>
        <div class="platform-example">${platform.example}</div>
      `;
      
      this.elements.serverlessPlatforms.appendChild(platformCard);
    });
  }

  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}