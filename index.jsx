import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, doc, updateDoc, setDoc, getDocs } from 'firebase/firestore';

// Define a interface para um presente
const GiftItem = ({ gift, onChooseGift, userId }) => {
    const [guestName, setGuestName] = useState('');
    const [showInput, setShowInput] = useState(false);

    // Função para lidar com a escolha do presente
    const handleChoose = () => {
        if (guestName.trim() === '') {
            // Usar um modal personalizado em vez de alert()
            // alert('Por favor, insira seu nome antes de escolher o presente.');
            console.log('Por favor, insira seu nome antes de escolher o presente.'); // Para depuração
            return;
        }
        onChooseGift(gift.id, guestName);
        setShowInput(false); // Esconde o input após escolher
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-md mb-4 flex flex-col md:flex-row items-center justify-between">
            <div className="text-lg font-semibold text-gray-800 mb-2 md:mb-0">
                {gift.name}
            </div>
            {gift.isTaken ? (
                <div className="text-green-600 font-medium">
                    Reservado por: {gift.takenBy}
                </div>
            ) : (
                <div className="flex flex-col md:flex-row items-center">
                    {showInput ? (
                        <>
                            <input
                                type="text"
                                placeholder="Seu Nome"
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                className="p-2 border border-gray-300 rounded-md mr-2 w-full md:w-auto mb-2 md:mb-0"
                            />
                            <button
                                onClick={handleChoose}
                                className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 w-full md:w-auto"
                            >
                                Escolher
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setShowInput(true)}
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 w-full md:w-auto"
                        >
                            Reservar
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const App = () => {
    const [gifts, setGifts] = useState([]);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState('');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    // Configuração inicial do Firebase
    useEffect(() => {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

        if (Object.keys(firebaseConfig).length === 0) {
            console.error("Firebase config is missing. Please ensure __firebase_config is provided.");
            setMessage("Erro: Configuração do Firebase ausente.");
            setLoading(false);
            return;
        }

        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestoreDb);
            setAuth(firebaseAuth);

            // Autenticar o usuário
            const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
            if (initialAuthToken) {
                signInWithCustomToken(firebaseAuth, initialAuthToken)
                    .then(() => console.log("Signed in with custom token"))
                    .catch(error => {
                        console.error("Error signing in with custom token:", error);
                        signInAnonymously(firebaseAuth)
                            .then(() => console.log("Signed in anonymously"))
                            .catch(anonError => console.error("Error signing in anonymously:", anonError));
                    });
            } else {
                signInAnonymously(firebaseAuth)
                    .then(() => console.log("Signed in anonymously"))
                    .catch(error => console.error("Error signing in anonymously:", error));
            }

            // Observar mudanças no estado de autenticação
            onAuthStateChanged(firebaseAuth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    setLoading(false);
                } else {
                    setUserId(crypto.randomUUID()); // Fallback para ID de usuário aleatório se não autenticado
                    setLoading(false);
                }
            });

        } catch (error) {
            console.error("Error initializing Firebase:", error);
            setMessage("Erro ao inicializar o Firebase.");
            setLoading(false);
        }
    }, []);

    // Carregar e ouvir a lista de presentes
    useEffect(() => {
        if (!db || !userId) return;

        const giftsCollectionRef = collection(db, `artifacts/${__app_id}/public/data/weddingGifts`);
        const q = query(giftsCollectionRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const giftsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Ordenar presentes: disponíveis primeiro, depois reservados, ambos em ordem alfabética
            giftsData.sort((a, b) => {
                if (a.isTaken === b.isTaken) {
                    return a.name.localeCompare(b.name);
                }
                return a.isTaken ? 1 : -1; // Disponíveis (false) vêm antes dos reservados (true)
            });

            setGifts(giftsData);

            // Se não houver presentes, adicione alguns exemplos
            if (giftsData.length === 0) {
                addInitialGifts(giftsCollectionRef);
            }
        }, (error) => {
            console.error("Erro ao carregar presentes:", error);
            setMessage("Erro ao carregar a lista de presentes.");
        });

        return () => unsubscribe(); // Limpeza do listener
    }, [db, userId]);

    // Adiciona presentes iniciais se a lista estiver vazia
    const addInitialGifts = async (giftsCollectionRef) => {
        const initialGifts = [
            { name: 'Liquidificador', isTaken: false, takenBy: '' },
            { name: 'Batedeira', isTaken: false, takenBy: '' },
            { name: 'Cafeteira', isTaken: false, takenBy: '' },
            { name: 'Jogo de Panelas', isTaken: false, takenBy: '' },
            { name: 'Aspirador de Pó', isTaken: false, takenBy: '' },
            { name: 'Air Fryer', isTaken: false, takenBy: '' },
            { name: 'Robô Aspirador', isTaken: false, takenBy: '' },
            { name: 'Máquina de Lavar', isTaken: false, takenBy: '' },
            { name: 'Geladeira', isTaken: false, takenBy: '' },
            { name: 'Forno Elétrico', isTaken: false, takenBy: '' },
            { name: 'Micro-ondas', isTaken: false, takenBy: '' },
            { name: 'Smart TV', isTaken: false, takenBy: '' },
            { name: 'Home Theater', isTaken: false, takenBy: '' },
            { name: 'Faqueiro', isTaken: false, takenBy: '' },
            { name: 'Jogo de Jantar', isTaken: false, takenBy: '' },
            { name: 'Jogo de Copos', isTaken: false, takenBy: '' },
            { name: 'Toalhas de Banho', isTaken: false, takenBy: '' },
            { name: 'Roupas de Cama', isTaken: false, takenBy: '' },
            { name: 'Ferro de Passar', isTaken: false, takenBy: '' },
            { name: 'Tábua de Passar', isTaken: false, takenBy: '' },
            { name: 'Secador de Cabelo', isTaken: false, takenBy: '' },
            { name: 'Fone de Ouvido Sem Fio', isTaken: false, takenBy: '' },
            { name: 'Caixa de Som Bluetooth', isTaken: false, takenBy: '' },
            { name: 'Bicicleta', isTaken: false, takenBy: '' },
            { name: 'Kit Churrasco', isTaken: false, takenBy: '' },
            { name: 'Máquina de Gelo', isTaken: false, takenBy: '' },
            { name: 'Adega Climatizada', isTaken: false, takenBy: '' },
            { name: 'Panela de Pressão Elétrica', isTaken: false, takenBy: '' },
            { name: 'Grill Elétrico', isTaken: false, takenBy: '' },
            { name: 'Sanduicheira', isTaken: false, takenBy: '' },
            { name: 'Chaleira Elétrica', isTaken: false, takenBy: '' },
            { name: 'Torradeira', isTaken: false, takenBy: '' },
            { name: 'Processador de Alimentos', isTaken: false, takenBy: '' },
            { name: 'Mesa de Centro', isTaken: false, takenBy: '' },
            { name: 'Abajur', isTaken: false, takenBy: '' },
            { name: 'Tapete', isTaken: false, takenBy: '' },
            { name: 'Cortina', isTaken: false, takenBy: '' },
            { name: 'Espelho Decorativo', isTaken: false, takenBy: '' },
            { name: 'Vaso de Flores', isTaken: false, takenBy: '' },
            { name: 'Kit Vinho', isTaken: false, takenBy: '' },
            { name: 'Taças de Vinho', isTaken: false, takenBy: '' },
            { name: 'Balde de Gelo', isTaken: false, takenBy: '' },
            { name: 'Coqueteleira', isTaken: false, takenBy: '' },
            { name: 'Aparelho de Jantar Completo', isTaken: false, takenBy: '' },
            { name: 'Jogo de Chá/Café', isTaken: false, takenBy: '' },
            { name: 'Utensílios de Cozinha', isTaken: false, takenBy: '' },
            { name: 'Balança de Cozinha', isTaken: false, takenBy: '' },
            { name: 'Garrafa Térmica', isTaken: false, takenBy: '' },
            { name: 'Copo Térmico', isTaken: false, takenBy: '' },
            { name: 'Kit de Potes Herméticos', isTaken: false, takenBy: '' },
            { name: 'Organizador de Armário', isTaken: false, takenBy: '' },
            { name: 'Cesto de Roupa Suja', isTaken: false, takenBy: '' },
            { name: 'Kit Limpeza', isTaken: false, takenBy: '' },
            { name: 'Vassoura Elétrica', isTaken: false, takenBy: '' },
            { name: 'Mop Giratório', isTaken: false, takenBy: '' },
            { name: 'Câmera de Segurança', isTaken: false, takenBy: '' },
            { name: 'Assistente Virtual', isTaken: false, takenBy: '' },
            { name: 'Smartwatch', isTaken: false, takenBy: '' },
            { name: 'Notebook', isTaken: false, takenBy: '' },
            { name: 'Impressora', isTaken: false, takenBy: '' },
            { name: 'Monitor', isTaken: false, takenBy: '' },
            { name: 'Teclado e Mouse Sem Fio', isTaken: false, takenBy: '' },
            { name: 'Webcam', isTaken: false, takenBy: '' },
            { name: 'Microfone', isTaken: false, takenBy: '' },
            { name: 'Cadeira Gamer', isTaken: false, takenBy: '' },
            { name: 'Mesa Gamer', isTaken: false, takenBy: '' },
            { name: 'Projetor', isTaken: false, takenBy: '' },
            { name: 'Soundbar', isTaken: false, takenBy: '' },
            { name: 'Vitrola', isTaken: false, takenBy: '' },
            { name: 'Jogos de Tabuleiro', isTaken: false, takenBy: '' },
            { name: 'Kit de Pintura', isTaken: false, takenBy: '' },
            { name: 'Kit de Maquiagem', isTaken: false, takenBy: '' },
            { name: 'Massageador', isTaken: false, takenBy: '' },
            { name: 'Esteira Ergométrica', isTaken: false, takenBy: '' },
            { name: 'Bicicleta Ergométrica', isTaken: false, takenBy: '' },
            { name: 'Kit de Boxe', isTaken: false, takenBy: '' },
            { name: 'Mochila de Viagem', isTaken: false, takenBy: '' },
            { name: 'Malas de Viagem', isTaken: false, takenBy: '' },
            { name: 'Kit Camping', isTaken: false, takenBy: '' },
            { name: 'Câmera Fotográfica', isTaken: false, takenBy: '' },
            { name: 'Drone', isTaken: false, takenBy: '' },
            { name: 'Kit Pesca', isTaken: false, takenBy: '' },
            { name: 'Churrasqueira Portátil', isTaken: false, takenBy: '' },
            { name: 'Ventilador', isTaken: false, takenBy: '' },
            { name: 'Aquecedor', isTaken: false, takenBy: '' },
            { name: 'Umidificador', isTaken: false, takenBy: '' },
            { name: 'Purificador de Ar', isTaken: false, takenBy: '' },
            { name: 'Roupão', isTaken: false, takenBy: '' },
            { name: 'Pijama', isTaken: false, takenBy: '' },
            { name: 'Travesseiro', isTaken: false, takenBy: '' },
            { name: 'Cobertor', isTaken: false, takenBy: '' },
            { name: 'Edredom', isTaken: false, takenBy: '' },
            { name: 'Cama', isTaken: false, takenBy: '' },
            { name: 'Guarda-Roupa', isTaken: false, takenBy: '' },
            { name: 'Sofá', isTaken: false, takenBy: '' },
            { name: 'Poltrona', isTaken: false, takenBy: '' },
            { name: 'Rack', isTaken: false, takenBy: '' },
            { name: 'Luminária de Chão', isTaken: false, takenBy: '' },
            { name: 'Luminária de Mesa', isTaken: false, takenBy: '' },
            { name: 'Lustre', isTaken: false, takenBy: '' },
            { name: 'Máquina de Lavar Louça', isTaken: false, takenBy: '' },
            { name: 'Secadora de Roupas', isTaken: false, takenBy: '' },
            { name: 'Máquina de Café Expresso', isTaken: false, takenBy: '' },
            { name: 'Cooktop', isTaken: false, takenBy: '' },
            { name: 'Coifa', isTaken: false, takenBy: '' }
        ];

        // Adiciona apenas os primeiros 50 itens se a coleção estiver vazia
        // Isso evita adicionar itens duplicados em recargas subsequentes se a lista já foi populada
        getDocs(giftsCollectionRef).then(snapshot => {
            if (snapshot.empty) {
                initialGifts.forEach(gift => {
                    setDoc(doc(giftsCollectionRef), gift)
                        .catch(error => console.error("Erro ao adicionar presente inicial:", error));
                });
            }
        }).catch(error => {
            console.error("Erro ao verificar presentes iniciais:", error);
        });
    };

    // Função para escolher um presente
    const handleChooseGift = async (giftId, guestName) => {
        if (!db) {
            console.error("Firestore não está inicializado.");
            setMessage("Erro: O banco de dados não está pronto. Tente novamente.");
            return;
        }

        const giftRef = doc(db, `artifacts/${__app_id}/public/data/weddingGifts`, giftId);
        try {
            await updateDoc(giftRef, {
                isTaken: true,
                takenBy: guestName
            });
            setMessage(`O presente "${gifts.find(g => g.id === giftId)?.name}" foi reservado por ${guestName}!`);
            setTimeout(() => setMessage(''), 3000); // Limpa a mensagem após 3 segundos
        } catch (error) {
            console.error("Erro ao escolher presente:", error);
            setMessage("Erro ao reservar o presente. Tente novamente.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 text-white">
                Carregando lista de presentes...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 p-4 sm:p-8 font-inter">
            <div className="max-w-4xl mx-auto bg-white bg-opacity-90 rounded-xl shadow-2xl p-6 sm:p-10">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-center text-gray-800 mb-6 drop-shadow-lg">
                    Nossa Lista de Presentes de Casamento
                </h1>
                <p className="text-center text-gray-600 mb-8 text-lg">
                    Escolha um presente para nos ajudar a construir nosso lar!
                </p>

                {message && (
                    <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative mb-4" role="alert">
                        {message}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                    {gifts.map(gift => (
                        <GiftItem key={gift.id} gift={gift} onChooseGift={handleChooseGift} userId={userId} />
                    ))}
                </div>

                <p className="text-center text-gray-500 mt-8 text-sm">
                    Obrigado por fazer parte do nosso dia especial!
                </p>
            </div>
        </div>
    );
};

export default App;
