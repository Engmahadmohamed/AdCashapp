// Database configuration
const config = {
    host: 'localhost',
    user: 'your_username',
    password: 'your_password',
    database: 'task_manager'
};

async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        const tasks = await response.json();
        
        const taskList = document.getElementById('taskList');
        taskList.innerHTML = '';
        
        tasks.forEach(task => {
            const taskElement = createTaskElement(task);
            taskList.appendChild(taskElement);
        });
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

async function addTask() {
    const taskInput = document.getElementById('taskInput');
    const taskText = taskInput.value.trim();
    
    if (taskText === '') return;

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: taskText })
        });

        if (response.ok) {
            taskInput.value = '';
            loadTasks(); // Reload the task list
        }
    } catch (error) {
        console.error('Error adding task:', error);
    }
}

async function deleteTask(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadTasks(); // Reload the task list
        }
    } catch (error) {
        console.error('Error deleting task:', error);
    }
}

function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = 'task-item';
    
    div.innerHTML = `
        <span>${task.text}</span>
        <button class="delete-btn" onclick="deleteTask(${task.id})">Delete</button>
    `;
    
    return div;
}

// Load tasks when the page loads
document.addEventListener('DOMContentLoaded', loadTasks); 