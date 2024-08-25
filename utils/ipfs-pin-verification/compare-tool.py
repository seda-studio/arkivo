def main():
    # Read and process the arkivo-db-cids.txt file
    with open('arkivo-db-cids.txt', 'r') as arkivo_file:
        arkivo_cids = set()
        for line in arkivo_file:
            cid = line.strip()  # Trim any leading/trailing whitespace
            if cid.startswith('ipfs://'):
                cid = cid[len('ipfs://'):]  # Remove the "ipfs://" prefix
            arkivo_cids.add(cid)

    # Read and process the ipfs-node-pins.txt file
    with open('ipfs-node-pins.txt', 'r') as ipfs_file:
        ipfs_cids = set()
        for line in ipfs_file:
            cid = line.strip()  # Trim any leading/trailing whitespace
            if cid.endswith(' recursive'):
                cid = cid[:-len(' recursive')]  # Remove the " recursive" suffix
            ipfs_cids.add(cid)

    # Find matches (CIDs present in both files)
    common_cids = arkivo_cids.intersection(ipfs_cids)
    with open('output-arkivo-cids-ok.txt', 'w') as common_file:
        for cid in common_cids:
            common_file.write(cid + '\n')

    # Find CIDs in arkivo-db-cids.txt but not in ipfs-node-pins.txt
    unpinned_cids = arkivo_cids.difference(ipfs_cids)
    with open('output-arkivo-cids-unpinned.txt', 'w') as unpinned_file:
        for cid in unpinned_cids:
            unpinned_file.write(cid + '\n')

    # Find CIDs in ipfs-node-pins.txt but not in arkivo-db-cids.txt
    unknown_cids = ipfs_cids.difference(arkivo_cids)
    with open('output-ipfs-node-unknown.txt', 'w') as unknown_file:
        for cid in unknown_cids:
            unknown_file.write(cid + '\n')

if __name__ == "__main__":
    main()