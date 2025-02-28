import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { getAddress } from "@ethersproject/address";
import { ExposedProductNft } from "../typechain/ExposedProductNft";
import { ExposedProductNftFactory } from "../typechain/ExposedProductNftFactory";
import { string } from "hardhat/internal/core/params/argumentTypes";

chai.use(solidity);



const { expect } = chai;

const BASE_URI = "https://token-cdn-domain/";
const START_RARER = 12;
const START_RARE = 1012;
const TOTAL_AMOUNT = 2012;

describe("ProductNft", () => {
  let productNft: ExposedProductNft,
    deployer: Signer,
    admin1: Signer,
    admin2: Signer,
    vault: Signer,
    addresses: Signer[];

  const setupProductNft = async () => {
    [deployer, admin1, admin2, vault, ...addresses] = await ethers.getSigners();
    productNft = await new ExposedProductNftFactory(deployer).deploy(
      BASE_URI, 
      await addresses[0].getAddress(), 
      await addresses[1].getAddress(), 
      START_RARER, 
      START_RARE, 
      TOTAL_AMOUNT
      );
    await productNft.deployed();
  };

  describe("Deployment", async () => {
    beforeEach(setupProductNft)

    it("should deploy", async () => {
      expect(productNft).to.be.ok;
    });
  })

  describe("Returning the right amounts to be minted", async () => {
    beforeEach(setupProductNft)

    it("returns the same amount of tokens for minting as given", async () => {
      await productNft.setTokensToMintPerRarity(12, "rarest");
      const mintAmount = 10;
      const rarestTokensLeft = await productNft.rarestTokensLeft();
      expect(await productNft.permittedAmount(mintAmount, "rarest", rarestTokensLeft)
      ).to.equal(mintAmount);
    });

    it("reduces amount of tokens if mint amount is higher than amount of tokens that are left", async () => {
      await productNft.setTokensToMintPerRarity(15, "rarest");
      const mintAmount = 14;
      const maximumAmountOfRarestAvailable = START_RARER;
      const rarestTokensLeft = await productNft.rarestTokensLeft();
      expect(await productNft.permittedAmount(mintAmount, "rarest", rarestTokensLeft)).to.equal(maximumAmountOfRarestAvailable);
    });  

    it("reduces amount of tokens if given mint amount (function variable) is higher than amount minted per batch (slowMintable)", async () => {
      const maxAmountOfNFTsForThisBatch = 10;
      await productNft.setTokensToMintPerRarity(maxAmountOfNFTsForThisBatch, "rarer");
      const mintAmount = 15;
      const rareTokensLeft = await productNft.rareTokensLeft();
      expect(await productNft.permittedAmount(mintAmount, "rarer", rareTokensLeft)).to.equal(maxAmountOfNFTsForThisBatch);
    });
    

    it("reverts when no token amount per batch mint is provided", async () => {
      const mintAmount = 5;
      const overridesRarest = {value: ethers.utils.parseEther("7.5")}
      await expect(productNft.rarestBatchMint(mintAmount, overridesRarest)
      ).to.be.revertedWith("Batch sold out");
    });
  });

  describe("Minting rarest, rarer and rare NFTs", async () => {
    beforeEach(setupProductNft)

    it("mints the next token Id by following a counter", async () => {
      const tokenCountBeforeIncrement = await productNft.rarestTokenIdCounter();
      await productNft.countBasedOnRarity(0);
      const tokenCountAfterIncrement = await productNft.rarestTokenIdCounter();
      expect(tokenCountAfterIncrement).to.equal(tokenCountBeforeIncrement.add(1));
    });

    it("batch mints a rarest NFT", async () => {
      await productNft.setTokensToMintPerRarity(START_RARER, "rarest");
      const overridesRarest = {value: ethers.utils.parseEther("7.5")}
      const tokenCountBeforeMint = await productNft.rarestTokenIdCounter();
      const mintAmount = 5;
      await productNft.rarestBatchMint(mintAmount, overridesRarest);
      const tokenCountAfterMint = await productNft.rarestTokenIdCounter();
      expect(tokenCountAfterMint).to.equal(tokenCountBeforeMint.add(5));
    });

    it("decreases the amount of tokens that are left after a rarest mint", async () => {
      await productNft.setTokensToMintPerRarity(10, "rarest");
      const overridesRarest = {value: ethers.utils.parseEther("7.5")}
      const tokensLeftBeforeMint = ethers.BigNumber.from(await productNft.rarestTokensLeft());
      const mintAmount = 5;
      await productNft.rarestBatchMint(mintAmount, overridesRarest);
      const tokensLeftAfterMint = ethers.BigNumber.from(await productNft.rarestTokensLeft());
      expect(tokensLeftBeforeMint).to.equal(tokensLeftAfterMint.add(5));
    }); 

    it("fails to batch mint rarest NFTs if sold out", async () => {
      await productNft.setTokensToMintPerRarity(14, "rarest");
      const overridesRarest = {value: ethers.utils.parseEther("20")}
      await productNft.rarestBatchMint(12, overridesRarest);
      const mintAmount = 3;
      await expect(productNft.rarestBatchMint(mintAmount, overridesRarest)
      ).to.be.revertedWith("");
    });

    it("reverts rarest batch mint when not enough Ether is sent", async () => {
      await productNft.setTokensToMintPerRarity(START_RARER, "rarest");
      const overridesRarest = {value: ethers.utils.parseEther("5")}
      const mintAmount = 9;
      await expect(productNft.rarestBatchMint(mintAmount, overridesRarest)
      ).to.be.revertedWith("Not enough ETH sent");
    });

    it("reverts rarest batch mint when the chosen amount is zero", async () => {
      await productNft.setTokensToMintPerRarity(10, "rarest");
      const overridesRarest = {value: ethers.utils.parseEther("5")}
      const mintAmount = 0;
      await expect(productNft.rarestBatchMint(mintAmount, overridesRarest)
      ).to.be.revertedWith("");
    });

    it("batch mints a rarer NFT", async () => {
      await productNft.setTokensToMintPerRarity(10, "rarer");
      const overridesRarer = {value: ethers.utils.parseEther("6")}
      const tokenIdBeforeMint = await productNft.rarerTokenIdCounter();
      const mintAmount = 5;
      await productNft.rarerBatchMint(mintAmount, overridesRarer);
      const tokenIdAfterMint = await productNft.rarerTokenIdCounter();
      expect(tokenIdAfterMint).to.equal(tokenIdBeforeMint.add(5));
    });

    it("reverts rarer batch mint when not enough Ether is sent", async () => {
      await productNft.setTokensToMintPerRarity(10, "rarer");
      const overridesRarer = {value: ethers.utils.parseEther("1")}
      const mintAmount = 4;
      await expect(productNft.rarerBatchMint(mintAmount, overridesRarer)
      ).to.be.revertedWith("Not enough ETH sent");
    });

    it("reverts rarer batch mint when the chosen amount is zero", async () => {
      await productNft.setTokensToMintPerRarity(10, "rarer");
      const overridesRarest = {value: ethers.utils.parseEther("5")}
      const mintAmount = 0;
      await expect(productNft.rarerBatchMint(mintAmount, overridesRarest)
      ).to.be.revertedWith("");
    });

    it("batch mints a rare NFT", async () => {
      await productNft.setTokensToMintPerRarity(10, "rare");
      const overridesRare = {value: ethers.utils.parseEther("5")}
      const tokenCountBeforeMint = await productNft.rareTokenIdCounter();
      const mintAmount = 10;
      await productNft.rareBatchMint(mintAmount, overridesRare);
      const tokenCountAfterMint = await productNft.rareTokenIdCounter();
      expect(tokenCountAfterMint).to.equal(tokenCountBeforeMint.add(10));
    });

    it("reverts rare batch mint when not enough Ether is sent", async () => {
      await productNft.setTokensToMintPerRarity(10, "rare");
      const overridesRarer = {value: ethers.utils.parseEther("1")}
      const mintAmount = 6;
      await expect(productNft.rareBatchMint(mintAmount, overridesRarer)
      ).to.be.revertedWith("Not enough ETH sent");
    });

    it("reverts rare batch mint when the chosen amount is zero", async () => {
      await productNft.setTokensToMintPerRarity(10, "rare");
      const overridesRarest = {value: ethers.utils.parseEther("5")}
      const mintAmount = 0;
      await expect(productNft.rareBatchMint(mintAmount, overridesRarest)
      ).to.be.revertedWith("");
    });
  });
  
  describe("setting the token URI with token Id and product status", async () => {
    beforeEach(async function setupNftAndMintTokens() {
      await setupProductNft()
      await productNft.setTokensToMintPerRarity(10, "rare");
      await productNft.setTokensToMintPerRarity(10, "rarer");
      await productNft.setTokensToMintPerRarity(10, "rarest");
      const mintAmount = 6;
      await productNft.rareBatchMint(mintAmount, {value: ethers.utils.parseEther("1.2")})
      const newBaseURI = "https://token-cdn-domainV2/";
      await productNft.setURI(newBaseURI);
    })

    it("returns a uri with the route {id}/{tokenstatus}.json", async() => {
      await productNft.rarerBatchMint(6, {value: ethers.utils.parseEther("3.3")})
      await productNft.rarestBatchMint(6, {value: ethers.utils.parseEther("9")})
      
      let returnUri = await productNft.uri(1013);
      expect(returnUri).to.eq('https://token-cdn-domainV2/1013/ready.json')
      returnUri = await productNft.uri(1);
      expect(returnUri).to.eq('https://token-cdn-domainV2/1/ready.json')
      returnUri = await productNft.uri(13);
      expect(returnUri).to.eq('https://token-cdn-domainV2/13/not-ready.json')
    });

    it("returns serves updated uri based on token status", async() => {
      await productNft.switchProductStatusToRedeemed([1013, 1014, 1015])
      const returnUri = await productNft.uri(1013);
      expect(returnUri).to.eq('https://token-cdn-domainV2/1013/redeemed.json')
    });

    it("should show token in status 'not-ready' if token hasn't been minted", async() => {
      const returnUri = await productNft.uri(2000);
      expect(returnUri).to.eq('https://token-cdn-domainV2/2000/not-ready.json')
    });
  });

  describe("emit token Info by tokenId", async () => {
    beforeEach(setupProductNft)

    it("emits token info when tokenId is given", async() => {
      await productNft.setTokensToMintPerRarity(10, "rarest");
      const overridesRarest = {value: ethers.utils.parseEther("7.5")}
      const mintAmount = 5;
      const mintFunction = await productNft.rarestBatchMint(mintAmount, overridesRarest);
      const tokenIdList = [1, 2, 3, 4, 5];
      const rarity = await productNft.returnRarityById(tokenIdList[1]);
      expect(mintFunction).to.emit(productNft, "MintedTokenInfo").withArgs(
        tokenIdList[1], rarity, "ready",
      );
    });
  });

  describe("withdrawal of ether", async () => {
    beforeEach(setupProductNft)

    it("withdraws ether stored in contract", async() => {
      await productNft.setTokensToMintPerRarity(10, "rarest");
      const overridesRarest = {value: ethers.utils.parseEther("7.5")}
      const mintAmount = 5;
      await productNft.rarestBatchMint(mintAmount, overridesRarest);
      await productNft.connect(deployer).withdrawEther();
      const provider = ethers.provider;
      const balanceContract = await productNft.provider.getBalance(productNft.address);
      expect(balanceContract).to.equal(ethers.utils.parseEther("0"));
    });
  });


  describe("setting the product status of an array of token Ids", async () => {
    beforeEach(setupProductNft)

    it("sets the product status to ready for Mycelia and Silver NFTs", async() => {
      const tokenIdList = [1, 3, 5, 7, 8];
      const rarity = 2;
      await productNft.initialProductStatusBasedOnRarity(tokenIdList[3], rarity);
      const getProductStatus = await productNft.ProductStatusByTokenId(tokenIdList[3]);
      const predictedProductStatus = 1;
      expect(getProductStatus).to.equal(predictedProductStatus);
    });

    it("switches the product status of not_ready to ready", async() => {
      await productNft.setTokensToMintPerRarity(12, "rarer");
      const overridesRarest = {value: ethers.utils.parseEther("7.5")}
      await productNft.rarerBatchMint(5, overridesRarest);
      const tokenIdList = [13, 14, 15, 16, 17];
      await productNft.connect(deployer).switchProductStatusToReady(tokenIdList);
      const getProductStatus = await productNft.ProductStatusByTokenId(tokenIdList[3]);
      expect(getProductStatus).to.equal(1);
    });

    it("switches the product status of ready to redeemed", async() => {
      await productNft.setTokensToMintPerRarity(12, "rarest");
      const overridesRarest = {value: ethers.utils.parseEther("7.5")}
      await productNft.rarestBatchMint(5, overridesRarest);
      const tokenIdList = [1, 2, 3, 4, 5];
      await productNft.connect(deployer).switchProductStatusToRedeemed(tokenIdList);
      const getProductStatus = await productNft.ProductStatusByTokenId(tokenIdList[2]);
      expect(getProductStatus).to.equal(2);
    });

    it("should fail if a token already set to ready is set to ready again", async() => {
      await productNft.setTokensToMintPerRarity(12, "rarest");
      const overridesRarest = {value: ethers.utils.parseEther("7.5")}
      await productNft.rarestBatchMint(5, overridesRarest);
      const tokenIdList = [1, 2, 3, 4, 5];
      await expect(productNft.connect(deployer).switchProductStatusToReady(tokenIdList)
      ).to.be.revertedWith("Wrong type");
    });

    it("should fail if attempting to set a token that is not ready to status redeemed", async() => {
      await productNft.setTokensToMintPerRarity(12, "rarest");
      const tokenIdList = [14, 19, 201, 560, 788];
      await expect(productNft.connect(deployer).switchProductStatusToRedeemed(tokenIdList)
      ).to.be.revertedWith("Not ready");
    });
  });

  describe("setting artist and amin roles and being able to update those addresses", async () => {
    beforeEach(setupProductNft)

    it("grants the admin and artist roles when the contract is redeemed", async () => {
      const adminRole = await productNft.DEFAULT_ADMIN_ROLE();
      const artistRole = await productNft.ARTIST_ROLE();
      expect(
        await productNft.hasRole(adminRole, await deployer.getAddress())
      ).to.equal(true);
      expect(
        await productNft.hasRole(artistRole, await addresses[1].getAddress())
      ).to.equal(true);
      expect(
        await productNft.hasRole(artistRole, await addresses[5].getAddress())
      ).to.equal(false);
    });

    it("updates the royalty receiving address of the artist", async () => {
      const addressArtistOld = await addresses[1].getAddress();
      const addressArtistNew = await addresses[2].getAddress();
      await productNft.connect(addresses[1]).updateRoyaltyReceiver(addressArtistOld, addressArtistNew);
      const addressArtistCall = await productNft.artistAddress();
      expect(addressArtistNew).to.equal(addressArtistCall);
    });

    it("fails when the previousReceiver does not have a role", async () => {
      const randomAddress = await addresses[5].getAddress();
      const addressNew = await addresses[2].getAddress();
      expect(productNft.connect(addresses[0]).updateRoyaltyReceiver(randomAddress, addressNew)
      ).to.be.revertedWith(
        "AccessControl: account 0x15d34aaf54267db7d7c367839aaf71a00a2c6a65 is missing role 0x877a78dc988c0ec5f58453b44888a55eb39755c3d5ed8d8ea990912aa3ef29c6");
    });
  });
});