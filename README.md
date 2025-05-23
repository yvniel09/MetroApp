# MetroApp
MetroApp is a functional prototype application that seeks to be a technological solution for the OPRET services in the Dominican Republic.
![Diseño_sin_título-removebg-preview](https://github.com/user-attachments/assets/3ae1f9d6-74c1-4d0f-9801-032a82dae922)
## ¿How does it works?
It can be tested via an electronic prototype builted for visualizing the application results. 
You can see my video testing and showing the prototype:
### ENGLISH: https://youtu.be/FEpfXaH57qQ
### ESPAÑOL: https://youtube.com/shorts/X77WyyUxNfo
# Get started
- Remember to always download the development build APK on your phone or emulator.
```bash
  npm install
  cd MetroApp
  npx expo start
```
### once started you will se a signup/signin screen like this
![image](https://github.com/user-attachments/assets/1df44b6a-319d-4323-8e47-ce53a9537c15)
### then in there you'll see the cards screen, For adding a new card hit the "+" icon and approach an NFC tag. Remember enabling the NFC on your device.
![image](https://github.com/user-attachments/assets/158c3ff2-a270-4c34-8277-169ce339f5b8)
when you already set it all now you need to get into the prototype connection.
In the ESP32 code you will se ssid and password to edit to your local connection

![image](https://github.com/user-attachments/assets/2b7533a5-2f0f-4373-a76f-fcf2b9d61a6e)

When you upload the code and ran correctly you will see in the serial or LCD screen a IP connection that is going to be your websocket IP to communicate between app/prototype
![image](https://github.com/user-attachments/assets/a3787eda-8700-4fb4-a0b5-85ff20616305)
if everything goes correctly you will get a message confirming your connection in the pass section: 
![image](https://github.com/user-attachments/assets/24d4e9f6-4ff3-46d1-810f-fd16fce1b9ac)

### now you can interact with the prototype spending and recharging everytime you need.
