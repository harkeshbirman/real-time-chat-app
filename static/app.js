const socket = io('ws://localhost:8080');

socket.on('message', text => {
    const e1 = document.createElement('li');
    e1.innerHTML = text;
    document.querySelector('ul').appendChild(e1)
})

document.querySelector('button').onclick = () => {
    let text = document.querySelector('input').value;
    socket.emit('message', text);
}

